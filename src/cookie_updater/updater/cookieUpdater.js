import fs from 'fs';
import os from 'os';
import path from 'path';
import axios from "axios";
import dotenv from 'dotenv';
import { plugin } from "puppeteer-with-fingerprints";
import { updateCookieFileOnS3 } from "../../../WB_module/S3/controller/s3Controller.js";
import { sendErrorToTelegram } from "../../../WB_module/telegram/telegramErrorNotifier.js";
import { getFullSessionByPhone } from "../../../WB_module/session/controller/sessionController.js";
import { 
    getCurrentIPWithPuppeteer, 
    getCurrentIP, 
    checkProxy, 
    checkProxyWithPuppeteer 
} from "../../../WB_module/network/controller/networkController.js";

dotenv.config();

// Функция инициализирует и проверяет начальный IP и работоспособность прокси.
async function initializeAndCheck(proxyString, phoneNumber) {
    console.log('Получаем IP без прокси...');
    const initialIP = await getCurrentIP(axios);
    if (!initialIP) {
        console.error('Не удалось определить начальный IP. Выход...');
        await sendErrorToTelegram(`Не удалось определить начальный IP для номера ${phoneNumber}, прокси ${proxyString}`, 'initializeAndCheck');
        return false;
    }
    
    console.log('Начинаем проверку прокси...');
    const isProxyWorking = await checkProxy(proxyString);
    if (!isProxyWorking) {
        console.error('Прокси не работает. Выход...');
        await sendErrorToTelegram(`Не смогли подключить прокси proxyString для номера  ${phoneNumber}, прокси ${proxyString}.`, 'checkProxy');
        return false;
    }
    console.log('Прокси работает');
    console.log('IP без прокси', initialIP);
    return initialIP;
}

// Функция инициализирует браузер, устанавливает прокси, открывает страницы.
async function setupBrowserAndPages(proxyString, fingerprint, cookies, phoneNumber) {
    try {
        console.log('Начинаем настройку браузера...');
        const proxyParts = proxyString.split(':');
        if (proxyParts.length !== 4) {
            throw new Error('Некорректная строка прокси. Прокси должен быть в формате IP:PORT:USER:PASS');
        }

        console.log('Выставляем прокси и отпечаток...');
        await plugin.useProxy(`${proxyString}`);
        await plugin.useFingerprint(fingerprint, {
            emulateDeviceScaleFactor: false,
            usePerfectCanvas: true,
            safeElementSize: true,
        });

        const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer-'));

        console.log('Запускаем браузер...');
        const browser = await plugin.launch({
            headless: true,
            userDataDir: userDataDir,
        });


        const page = await browser.newPage();
        const pageForIPCheck = await browser.newPage();

        await page.setCookie(...cookies);

        return { browser, page, pageForIPCheck, userDataDir };

    } catch (error) {
        console.error(`Ошибка при настройке браузера и страниц: ${error.message}`);
        await sendErrorToTelegram(`Ошибка при настройке браузера и страниц для номера ${phoneNumber}, прокси ${proxyString}: ${error.message}`, 'setupBrowserAndPages');
        return null;
    }
}

// Функция проверки работы прокси внутри puppeteer.
async function checkPuppeteerProxy(pageForIPCheck, initialIP, proxyString, phoneNumber) {
    try {
        if (!(await checkProxyWithPuppeteer(pageForIPCheck, initialIP))) {
            console.error('Прокси не работает внутри puppeteer. Выход...');
            await sendErrorToTelegram(`Прокси ${proxyString} не работает внутри puppeteer для номера ${phoneNumber}.`, 'checkPuppeteerProxy');
            return false;
        }
        return true;
  
    } catch (error) {
        console.error(`Ошибка при проверке прокси в puppeteer: ${error.message}`);
        await sendErrorToTelegram(`Ошибка при проверке прокси ${proxyString} в puppeteer для номера ${phoneNumber}: ${error.message}`, 'checkPuppeteerProxy');
        return false;
    }
}

// Функция проверки работы прокси внутри puppeteer с повторными попытками.
async function checkPuppeteerProxyWithRetries(pageForIPCheck, initialIP, proxyString, phoneNumber, retries = 3) {
    let attempt = 0;
    while (attempt < retries) {
        try {
            if (await checkProxyWithPuppeteer(pageForIPCheck, initialIP)) {
                return true;
            }
        } catch (error) {
            console.error(`Ошибка при проверке прокси в puppeteer (попытка ${attempt + 1}): ${error.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, 30000));
        attempt++;
    }
    await sendErrorToTelegram(`Прокси ${proxyString} не работает в puppeteer после ${retries} попыток при добавлении в корзину для номера ${phoneNumber}.`, 'checkPuppeteerProxyWithRetries');
    return false;
}

// Функция для загрузки страницы с повторными попытками
async function loadPage(page, phoneNumber, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            await page.goto('https://www.wildberries.ru/lk', {
                waitUntil: 'networkidle2',
                timeout: 180000
            });

            const userElementSelector = '.lk-item.lk-item--user';
            const errorElementSelector = 'h2.sign-in-page__title[data-link]';
            const result = await Promise.race([
                page.waitForSelector(userElementSelector, { visible: true, timeout: 180000 }).then(() => 'userElementLoaded'),
                page.waitForSelector(errorElementSelector, { visible: true, timeout: 180000 }).then(() => 'errorElementLoaded')
            ]);

            if (result === 'errorElementLoaded') {
                console.error('Загрузилась страница авторизации, куки не работают.');
                await sendErrorToTelegram(`Загрузилась страница авторизации, куки не работают для номера ${phoneNumber}.`, 'loadPage');
                return 'ERROR_PAGE_LOADED';
            }

            console.log('-------> WB открыт (Wildberries открыт)');
            return 'SUCCESS';
        } catch (error) {
            console.error(`Произошла ошибка при загрузке ВБ (попытка ${attempt + 1}): ${error.message}`);
            if (attempt === maxRetries - 1) {
                await sendErrorToTelegram(`Не удалось загрузить ВБ после ${maxRetries} попыток для номера ${phoneNumber}.`, 'loadPage');
            }
        }
    }
}

export async function updateCookieAfterUse(phoneNumber, proxyString) {
    let checkInterval;
    let browser;
    let userDataDir; 

    try {
        const initialIP = await initializeAndCheck(proxyString, phoneNumber);
        if (!initialIP) {
            return 'NO_AVAILABLE_PROXY';
        }

        const { cookies, fingerprint } = await getFullSessionByPhone(phoneNumber);

        // console.log('cookies', cookies);

        const setupResult = await setupBrowserAndPages(proxyString, fingerprint, cookies, phoneNumber);

        browser = setupResult.browser;
        userDataDir = setupResult.userDataDir;

        // Проверяем, подключен ли прокси
        if (!(await checkPuppeteerProxy(setupResult.pageForIPCheck, initialIP, proxyString, phoneNumber))) return;

        // Периодически проверяем прокси
        checkInterval = setInterval(async () => {
            if (!(await checkPuppeteerProxyWithRetries(setupResult.pageForIPCheck, initialIP, proxyString, phoneNumber))) {
                console.error(`Потеряли связь с прокси . Выход...`);
                await clearInterval(checkInterval);
                if (browser) {
                    await browser.close();
                }
                return;
            }
        }, 2 * 60 * 1000);

        console.log('Выводим страницу для взаимодействия...');
        await setupResult.page.bringToFront();
        
        console.log('Загружаем ВБ...');
        await loadPage(setupResult.page, phoneNumber);

        let updatedCookies;
        updatedCookies = await setupResult.page.cookies();
        // console.log('updatedCookies', updatedCookies);

        let hasWildAuthNewV3;
        hasWildAuthNewV3 = updatedCookies.some(cookie => cookie.name === 'WILDAUTHNEW_V3');
        if (!hasWildAuthNewV3) {
            console.log('Повторно загружаем ВБ...');
            await setupResult.page.reload({
                waitUntil: 'networkidle2',
                timeout: 180000
            });
            await setupResult.page.waitForSelector('.lk-item.lk-item--user', { visible: true, timeout: 180000 });
        
            updatedCookies = await setupResult.page.cookies();
            hasWildAuthNewV3 = updatedCookies.some(cookie => cookie.name === 'WILDAUTHNEW_V3');
            if (!hasWildAuthNewV3) {
                console.error('WILDAUTHNEW_V3 cookie отсутствует.');
                throw new Error('WILDAUTHNEW_V3 cookie is отсутствует.');
            }
        }

        const uploadResponse = await updateCookieFileOnS3(phoneNumber, updatedCookies);

        if (uploadResponse) {
            console.log('Успешно обновили куки');
            return "SUCCESS";
        } else {
            console.error('Ошибка при обновлении кук на S3');
            return 'ERROR';
        }

    } catch (error) {
        console.error(`-------> Произошла ошибка: ${error.message}`);
        await sendErrorToTelegram(`Ошибка при обновлении cookies для номера ${phoneNumber}: ${error.message}`, 'updateCookieAfterUse');
        return 'ERROR';
    } finally {
        if (checkInterval) {
            clearInterval(checkInterval); // Очистка интервала проверки прокси
        }
  
        await new Promise(resolve => setTimeout(resolve, 3000));

        if (browser) {
            await browser.close();
        }

        if (userDataDir) {
            fs.rm(userDataDir, { recursive: true, force: true }, (err) => {
                if (err) {
                    console.error(`Ошибка при удалении временной директории: ${err.message}`);
                }
            });
        }
      }
};
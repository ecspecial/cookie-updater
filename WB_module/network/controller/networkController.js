import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Функция для настройки образа axios с прокси
const setupAxiosWithProxy = async (proxyString) => {
    const proxy = proxyString.split(':');
    const formattedProxy = `${proxy[2]}:${proxy[3]}@${proxy[0]}:${proxy[1]}`;
    const httpsAgent = new HttpsProxyAgent(`http://${formattedProxy}`);
    return axios.create({
        httpsAgent: httpsAgent,
    });
}

// Функция для получения текущего IP адреса
const getCurrentIP = async (axiosInstance) => {
    const methods = [
        'https://ipv4.icanhazip.com/',
        'https://ipinfo.io/ip',
        'https://api.myip.com',
        'https://api.ipify.org/?format=json'
    ];

    for (let url of methods) {
        try {
            const response = await axiosInstance.get(url);
            const ip = response.data.ip || response.data.trim();
            if (ip) return ip;
        } catch (error) {
            console.warn('Не удалось получить текущий IP с помощью сайта', url);
        }
    }

    console.error('Не удалось получить текущий IP.');
    return null;
}

const getCurrentIPWithPuppeteer = async (page) => {
    const methods = [
        'https://api.ipify.org/?format=json',
        'https://ipv4.icanhazip.com/',
        'https://ipinfo.io/ip',
        'https://api.myip.com'
    ];

    for (let url of methods) {
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            const ipData = await page.content();
            const ipRegex = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/;
            const match = ipData.match(ipRegex);
            console.log(match[1]);
            if (match) return match[1];
        } catch (error) {
            console.warn('Ошибка при получении текущего IP через Puppeteer на', url);
        }
    }

    console.error('Ошибка при получении текущего IP через Puppeteer.');
    return null;
}

const checkProxyWithPuppeteer = async (page, originalIP) => {
    const ipWithProxy = await getCurrentIPWithPuppeteer(page);
    if (ipWithProxy && ipWithProxy !== originalIP) {
        return true;
    }
    return false;
}

// Функция для проверки прокси
const checkProxy = async (proxyString) => {
    // Получение IP до установки прокси
    const originalIP = await getCurrentIP(axios);

    // Установка полученного прокси axiosWithProxy
    const axiosWithProxy = await setupAxiosWithProxy(proxyString);
    const proxyIP = await getCurrentIP(axiosWithProxy);

    if (proxyIP && proxyIP !== originalIP) {
        console.log('Прокси работает:', proxyString, proxyIP, originalIP);
        return proxyIP;
    } else {
        console.error('Прокси не работает:', proxyString, proxyIP, originalIP);
        return null;
    }
}

export { setupAxiosWithProxy, getCurrentIP, checkProxy, getCurrentIPWithPuppeteer, checkProxyWithPuppeteer }
import { sendErrorToTelegram } from "../../telegram/telegramErrorNotifier.js";
import { 
    getCookiesByPhone, 
    getFingerprintByPhone, 
    getUAByPhone 
} from "../../S3/controller/s3Controller.js";

// Функция для получения сессии (cookies + fingerprint)
async function getFullSessionByPhone(phoneNumber) {
    let cookies, fingerprint, rawFingerprint;

    try {
        cookies = await getCookiesByPhone(phoneNumber);
    } catch (error) {
        console.error(`Ошибка при получении cookies для номера телефона ${phoneNumber}:`, error);
    }

    try {
        rawFingerprint = await getFingerprintByPhone(phoneNumber);
        fingerprint = JSON.stringify(rawFingerprint);
        // console.log('FINGERPRINT', fingerprint)
    } catch (error) {
        console.error(`Ошибка при получении fingerprintUA для номера телефона ${phoneNumber}:`, error);
    }

    if (!cookies || !fingerprint) {
        const errorMessage = `Ошибка при создании сессии для номера телефона ${phoneNumber}: невозможно получить cookies или fingerprint`;
        console.error(errorMessage);
        await sendErrorToTelegram(errorMessage, 'getSessionByPhone');
        throw new Error(errorMessage);
    }

    return { cookies, fingerprint  };
}

// Функция для получения сессии (cookies + fingerprintUA)
async function getSessionByPhone(phoneNumber) {
    let cookies, fingerprintUA;

    try {
        cookies = await getCookiesByPhone(phoneNumber);
    } catch (error) {
        console.error(`Ошибка при получении cookies для номера телефона ${phoneNumber}:`, error);
    }

    try {
        fingerprintUA = await getUAByPhone(phoneNumber);
        // console.log('FINGERPRINT', fingerprint)
    } catch (error) {
        console.error(`Ошибка при получении fingerprintUA для номера телефона ${phoneNumber}:`, error);
    }

    if (!cookies || !fingerprintUA) {
        const errorMessage = `Ошибка при создании сессии для номера телефона ${phoneNumber}: невозможно получить cookies или fingerprint`;
        console.error(errorMessage);
        await sendErrorToTelegram(errorMessage, 'getSessionByPhone');
        throw new Error(errorMessage);
    }

    return { cookies, fingerprintUA  };
}

export { getSessionByPhone, getFullSessionByPhone }
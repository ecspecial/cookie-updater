import axios from "axios";

// Вспомогательная функция для получения прокси с повторными попытками
export async function getProxyWithRetries(retries = 5) {
    let lastError = null;
    const waitTime = 120000;

    for (let i = 0; i < retries; i++) {
        try {
            const proxyResponse = await axios.get('http://localhost:4000/api/proxy/random-proxy');
            
            if (proxyResponse.status === 200 && proxyResponse.data && proxyResponse.data.proxy) {
                return proxyResponse.data.proxy;
            }

            if (proxyResponse.status === 404 && proxyResponse.data.error === 'Нет свободных прокси') {
                throw new Error('NO_AVAILABLE_PROXY');
            }

            switch (proxyResponse.status) {
                case 404: 
                    lastError = new Error('Нет свободных прокси');
                    break;
                case 503: 
                    lastError = new Error('Сервис временно недоступен');
                    break;
                case 500: 
                    lastError = new Error('Внутренняя ошибка сервера');
                    break;
                default:
                    lastError = new Error(`Неожиданный формат ответа от главного апи при получении свободного прокси. Ответ сервера: ${JSON.stringify(proxyResponse.data)}`);
            }
            
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }

        } catch (error) {
            lastError = error;
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }

    throw new Error(`Ошибка при получении прокси после множественных попыток. Last error: ${lastError.message}`);
};

// Вспомогательная функция для получения свободного аккаунта
export async function getRandomPhoneNumberWithRetries(id, type,  retries = 5) {
    let lastError = null;
    const waitTime = 60000;

    for (let i = 0; i < retries; i++) {
        try {
            const phoneNumberResponse = await axios.get(`http://localhost:4000/api/account/accounts/random-free?likeId=${id}&type=${type}`);
            
            if (phoneNumberResponse.status === 200 && phoneNumberResponse.data && phoneNumberResponse.data.number) {
                return {
                    id: phoneNumberResponse.data._id,
                    number: phoneNumberResponse.data.number
                };
            }

            if (phoneNumberResponse.status === 404 && phoneNumberResponse.data.error === 'Аккаунт со статусом "free" не найден') {
                throw new Error('NO_AVAILABLE_ACCOUNT');
            }

            switch (phoneNumberResponse.status) {
                case 404:
                    lastError = new Error('Нет свободных номеров');
                    break;
                case 503: 
                    lastError = new Error('Сервис временно недоступен');
                    break;
                case 500: 
                    lastError = new Error('Внутренняя ошибка сервера');
                    break;
                default:
                    lastError = new Error(`Неожиданный формат ответа от главного апи при получении свободного номера. Ответ сервера: ${JSON.stringify(phoneNumberResponse.data)}`);
            }

            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }

        } catch (error) {
            lastError = error;

            if (i < retries - 1 && (error.message === 'NO_AVAILABLE_ACCOUNT' || error.message.includes('Сервис временно недоступен'))) {
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }

    throw new Error(`Ошибка при получении номера после множественных попыток. Last error: ${lastError.message}`);
};

// Вспомогательная функция для получения свободного мобильного аккаунта
export async function getRandomMobileAccountWithRetries(idString, reviewId, type, retries = 5) {
    let lastError = null;
    const waitTime = 120000;

    for (let i = 0; i < retries; i++) {
        try {
            const mobileAccountResponse = await axios.get(`http://localhost:4000/api/account/accounts/random-mobile-free?documentId=${idString}&reviewId=${reviewId}&type=${type}`);

            if (mobileAccountResponse.status === 200 && mobileAccountResponse.data && mobileAccountResponse.data.number) {
                return {
                    number: mobileAccountResponse.data.number,
                    account: mobileAccountResponse.data.account
                };
            }

            if (mobileAccountResponse.status === 400 && mobileAccountResponse.data.error === 'Оба параметра, documentId и reviewId, обязательны для ввода') {
                throw new Error('INVALID_REQUEST');
            }

            if (mobileAccountResponse.status === 404 && mobileAccountResponse.data.error === 'Мобильный аккаунт со статусом "free" не найден') {
                throw new Error('NO_AVAILABLE_MOBILE_ACCOUNT');
            }

            switch (mobileAccountResponse.status) {
                case 400:
                    lastError = new Error('Неправильный формат запроса');
                    break;
                case 404:
                    lastError = new Error('Нет свободных мобильных аккаунтов');
                    break;
                case 503: 
                    lastError = new Error('Сервис временно недоступен');
                    break;
                case 500: 
                    lastError = new Error('Внутренняя ошибка сервера');
                    break;
                default:
                    lastError = new Error(`Неожиданный формат ответа от главного апи при получении свободного мобильного аккаунта. Ответ сервера: ${JSON.stringify(mobileAccountResponse.data)}`);
            }

            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }

        } catch (error) {
            lastError = error;

            if (i < retries - 1 && (error.message === 'NO_AVAILABLE_MOBILE_ACCOUNT' || error.message.includes('Сервис временно недоступен'))) {
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }

    throw new Error(`Ошибка при получении мобильного аккаунта после множественных попыток. Last error: ${lastError.message}`);
};
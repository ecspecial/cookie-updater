import axios from 'axios';
import dotenv from 'dotenv';

// Загрузка конфигурации
dotenv.config();

const TELEGRAM_API = "https://api.telegram.org";
const url = `${TELEGRAM_API}/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;

async function sendErrorToTelegram(errorDetail, functionName) {
    try {
        const notificationType = "Ошибка";
        const processName = "Лайки";
        const serverAddress = "000.000.00.000";

        const message = `
❌
*Тип уведомления* - ${notificationType}
*Процесс* - ${processName}
*Ошибка* - ${errorDetail}
*Функция* - ${functionName}
*Сервер* - ${serverAddress}
`;

        await axios.post(url, {
            chat_id: process.env.TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'Markdown'
        });
    } catch (telegramError) {
        console.error("Ошибка при отправке уведомления в Telegram:", telegramError.response ? telegramError.response.data : telegramError);
    }
}

export { sendErrorToTelegram }
// Функция для получения московского времени
const getCurrentDateInMoscow = async () => {
    const now = new Date();
    const moscowOffset = 3 * 60 * 60000; // МОСКВВА UTC+3
    return new Date(now.getTime() + moscowOffset);
}

// Конвертация периода в миллисекунды
const convertPeriodToMs = async (value, type) => {
    const hourMs = 3600000;
    const dayMs = 86400000;

    switch (type) {
        case 'hours':
        case 'hour':
        case 'h':
            return value * hourMs;
        case 'days':
        case 'day':
            return value * dayMs;
        default:
            throw new Error(`Неизвестный тип периода: ${type}`);
    }
}

// Конвертация расчета дат для начала с минимальным интервалом
const calculateStartTimesWithMinimumInterval = async (startDate, totalPeriodMs, numberOfActions, minimumInterval) => {
    let startTimes = [];
    let intervalMs = Math.max(totalPeriodMs / numberOfActions, minimumInterval);
    for (let i = 0; i < numberOfActions; i++) {
        startTimes.push(new Date(startDate.getTime() + intervalMs * i));
    }
    // console.log('startTimes', startTimes);
    return startTimes;
};

export { getCurrentDateInMoscow, convertPeriodToMs, calculateStartTimesWithMinimumInterval }
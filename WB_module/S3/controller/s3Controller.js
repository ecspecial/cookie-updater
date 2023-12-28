import path from 'path';
import aws4 from 'aws4';
import axios from 'axios';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import EasyYandexS3 from 'easy-yandex-s3';
import { sendErrorToTelegram } from '../../telegram/telegramErrorNotifier.js';

// Загрузка конфигурации
dotenv.config();

// Инициализация соединения с Yandex S3
const s3 = new EasyYandexS3({
    auth: {
        accessKeyId: process.env.YANDEX_ACCESS_KEY,
        secretAccessKey: process.env.YANDEX_SECRET_KEY,
    },
    Bucket: process.env.S3_BUCKET,
    debug: false,
});

// Функция для загрузки файлов на S3
export async function uploadFiles(localFolderPath, s3FolderPath) {
    try {
        const upload = await s3.Upload({
            path: `${localFolderPath}`,
            save_name: true,
        }, `${s3FolderPath}`);
        console.log(upload);
        return upload;
    } catch (error) {
        console.error("Ошибка при загрузке файлов:", error);
        throw error;
    }
}

export async function uploadFilesOneByOne(localFolderPath, s3FolderPath) {
  // Читаем список файлов в указанной папке
  const files = await fs.readdir(localFolderPath);
  
  for (let file of files) {
    const localFilePath = path.join(localFolderPath, file);
    const s3FilePath = `${s3FolderPath}`;

      const stats = await fs.stat(localFilePath);
      if (stats.isFile()) {
          console.log(`Загрузка ${localFilePath} в ${s3FilePath}...`);
          try {
              // Загружаем файл в S3 bucket
              const upload = await s3.Upload({
                  path: localFilePath,
                  save_name: true
              }, s3FilePath);
              
              console.log(`Успешно загружено ${localFilePath} в ${s3FilePath}`);
          } catch (error) {
              console.error(`Ошибка при загрузке ${localFilePath}:`, error);
          }
      }
  }
}

export async function remove () {
  s3.Remove('accs/Fing');
  s3.Remove('accs/Cuc');
  s3.Remove('accs/');
}

export async function listAccsContents() {
  try {
    let list = await s3.GetList('/accs/');
    
    // Отобразить список файлов
    if (list.Contents && list.Contents.length) {
      console.log("Файлы в директории accs:");
      list.Contents.forEach(item => {
        console.log(item.Key);
      });
    } else {
      console.log("Файлы в директории Fing не найдены.");
    }

    // Отобразить список поддиректорий (если есть)
    if (list.CommonPrefixes && list.CommonPrefixes.length) {
      console.log("Поддиректории в директории Fing:");
      list.CommonPrefixes.forEach(item => {
        console.log(item.Prefix);
      });
    } else {
      console.log("Поддиректории в директории Fing не найдены.");
    }

  } catch (error) {
    console.error("Ошибка при получении содержимого директории Fing:", error);
  }
}

// Функция для отображения содержимого директории Fing
export async function listFingContents() {
  try {
    let list = await s3.GetList('/accs/Fing/');
    
    // Отобразить список файлов
    if (list.Contents && list.Contents.length) {
      console.log("Файлы в директории Fing:");
      list.Contents.forEach(item => {
        console.log(item.Key);
      });
    } else {
      console.log("Файлы в директории Fing не найдены.");
    }

    // Отобразить список поддиректорий (если есть)
    if (list.CommonPrefixes && list.CommonPrefixes.length) {
      console.log("Поддиректории в директории Fing:");
      list.CommonPrefixes.forEach(item => {
        console.log(item.Prefix);
      });
    } else {
      console.log("Поддиректории в директории Fing не найдены.");
    }

  } catch (error) {
    console.error("Ошибка при получении содержимого директории Fing:", error);
  }
}

// Функция для отображения содержимого директории Cuc
export async function listCucContents() {
  try {
    let list = await s3.GetList('/accs/Cuc/');
    
    // Отобразить список файлов
    if (list.Contents && list.Contents.length) {
      console.log("Файлы в директории Cuc:");
      list.Contents.forEach(item => {
        console.log(item.Key);
      });
    } else {
      console.log("Файлы в директории Cuc не найдены.");
    }

    // Отобразить список поддиректорий (если есть)
    if (list.CommonPrefixes && list.CommonPrefixes.length) {
      console.log("Поддиректории в директории Cuc:");
      list.CommonPrefixes.forEach(item => {
        console.log(item.Prefix);
      });
    } else {
      console.log("Поддиректории в директории Cuc не найдены.");
    }

  } catch (error) {
    console.error("Ошибка при получении содержимого директории Cuc:", error);
  }
}

// Функция для отображения содержимого директории Cuc
export async function listContents() {
  try {
    let list = await s3.GetList('/accs/Fing');
    
    // Отобразить список файлов
    if (list.Contents && list.Contents.length) {
      console.log("Файлы в директории /:");
      list.Contents.forEach(item => {
        console.log(item.Key);
      });
    } else {
      console.log("Файлы в директории Cuc не найдены.");
    }

    // Отобразить список поддиректорий (если есть)
    if (list.CommonPrefixes && list.CommonPrefixes.length) {
      console.log("Поддиректории в директории Cuc:");
      list.CommonPrefixes.forEach(item => {
        console.log(item.Prefix);
      });
    } else {
      console.log("Поддиректории в директории Cuc не найдены.");
    }

  } catch (error) {
    console.error("Ошибка при получении содержимого директории Cuc:", error);
  }
}

// Получить отпечаток по номеру телефона
export async function getFingerprintByPhone(phoneNumber) {
  try {
      const fileContentBuffer = await s3.Download(`accs/Fing/${phoneNumber}.txt`);
      
      //  Проверка fileContentBuffer на наличие data и Body
      if (!fileContentBuffer.data || !fileContentBuffer.data.Body) {
          const errorMessage = `Файл отпечатка для номера ${phoneNumber} не найден.`;
          console.error(errorMessage);
          throw new Error(errorMessage);
      }
      
      const fileContent = fileContentBuffer.data.Body.toString();
      const parsedContent = JSON.parse(fileContent);
      return parsedContent;
  } catch (error) {
      const errorMessage = error.message.startsWith("Файл отпечатка") 
          ? error.message 
          : "Ошибка при загрузке отпечатка: " + error.message;
      console.error(errorMessage);
      await sendErrorToTelegram(errorMessage, "getFingerprintByPhone");
      throw error;
  }
}

// Получить cookies по номеру телефона
export async function getCookiesByPhone(phoneNumber) {
  try {
      const fileContentBuffer = await s3.Download(`accs/Cuc/${phoneNumber}.txt`);
      
      //  Проверка fileContentBuffer на наличие data и Body
      if (!fileContentBuffer.data || !fileContentBuffer.data.Body) {
          const errorMessage = `Файл cookies для номера ${phoneNumber} не найден.`;
          console.error(errorMessage);
          throw new Error(errorMessage);
      }
      
      const fileContent = fileContentBuffer.data.Body.toString();
      const parsedContent = JSON.parse(fileContent);
      return parsedContent.cookies;
  } catch (error) {
      const errorMessage = error.message.startsWith("Файл cookies") 
          ? error.message 
          : "Ошибка при загрузке cookies: " + error.message;
      console.error(errorMessage);
      await sendErrorToTelegram(errorMessage, "getCookiesByPhone"); // Отправляем ошибку в телеграм
      throw error;
  }
}

// Получить UA из отпечатка по номеру телефона
export async function getUAByPhone(phoneNumber) {
  try {
      const fingerprint = await getFingerprintByPhone(phoneNumber);
      
      if (!fingerprint || !fingerprint.ua) {
          const errorMessage = `UA для номера ${phoneNumber} не найден.`;
          console.error(errorMessage);
          throw new Error(errorMessage);
      }
      console.log(fingerprint.ua);
      return fingerprint.ua;
  } catch (error) {
      const errorMessage = error.message.startsWith("UA для номера") 
          ? error.message 
          : "Ошибка при загрузке UA: " + error.message;
      console.error(errorMessage);
      await sendErrorToTelegram(errorMessage, "getUAByPhone");
      throw error;
  }
}

// Функция для удаления всех файлов в S3 бакете
export async function clearAllFilesInBucket() {
  try {
      const list = await s3.GetList('/accs/Fing');
      const deletePromises = [];

      if (list.Contents && list.Contents.length) {
          list.Contents.forEach(item => {
              console.log(`Удаление файла: ${item.Key}`);
              deletePromises.push(s3.Remove(item.Key));
          });
      }

      // Выполняем все промисы удаления
      await Promise.all(deletePromises);
      console.log("Все файлы успешно удалены.");
  } catch (error) {
      console.error("Ошибка при удалении файлов из S3 бакета:", error);
  }
}

// Функция для обновления файла cookie на S3
export async function updateCookieFileOnS3(phoneNumber, cookieContent) {
  try {
      // Файл будет сохранен в эту папку в S3
      const s3FolderPath = 'accs/Cuc/'; 

      // Преобразование содержимого cookie в строку JSON
      const fileContent = JSON.stringify({ cookies: cookieContent });

      // Создание Buffer из строки JSON
      const buffer = Buffer.from(fileContent);

      // Загрузка файла на S3
      const upload = await s3.Upload({
          buffer,
          name: `${phoneNumber}.txt` // Имя файла
      }, s3FolderPath); // Путь к папке в S3

      console.log(`Файл cookie успешно обновлен для номера ${phoneNumber}`);
      return upload;
  } catch (error) {
      console.error(`Ошибка при обновлении файла cookie для номера ${phoneNumber}:`, error);
      throw error;
  }
}
import 'dotenv/config'
import TelegramBot from 'node-telegram-bot-api';
import got from 'got';
import fs from 'fs';

import telegramReplacer from './utils/telegramReplacer.js'
let banks = []

fs.readFile("./banks.json", "utf8", (err, jsonString) => {
    if (err) {
        console.log("File read failed:", err);
        return;
    }
    banks = JSON.parse(jsonString);
});

const token = process.env.TELEGRAM_BOT_TOKEN

const bot = new TelegramBot(token, {
    polling: true
});

const botOptions = {
    parse_mode: "MarkdownV2"
}

bot.on('message', async (msg) => {

    const apiBaseUrl = 'https://cekrekening.id/master'

    const chatId = msg.chat.id;
    const message = msg.text;

    if(message.match(/\/start (.+)/)){
        return
    }

    let bankAccountNumber

    try {
        bankAccountNumber = String(message.match(/\d+/g).join(''))
    } catch (error) {
        await bot.sendMessage(chatId, telegramReplacer('Anda bisa cek rekening dengan format:\nbank<spasi>nomorrekening\n\ncontoh:\nbca 12345678'), botOptions);
        return
    }

    const banksFilter = banks.filter((bank) => bank.bankName
        .toLowerCase()
        .includes(
            message.split(" ")[0]
        )
    )

    let results = 0

    for await (const bank of banksFilter) {
        const { data } = await got.post(`${apiBaseUrl}/cekrekening/report`, {
            json: {
                bankId: bank.id,
                bankAccountNumber
            }
        }).json();
        if (data !== null) {
            results++
            let msg = `${data.laporan.accountNo} ${data.laporan.accountName}\n`
            msg += `${data.laporan.bank.bankName}\n\n`
            msg += `${data.laporan.kategoriAduan.deskripsi}`
            await bot.sendMessage(chatId, telegramReplacer('HATI-HATI Rekening terindikasi digunakan untuk melakukan penipuan') + '\n\n' + telegramReplacer(msg), botOptions);

            if (data.laporanDetail.length > 0) {
                let details
                for await (const laporan of data.laporanDetail) {                
                    let yourDate = new Date(laporan.laporanDate)
                    const options = { dateStyle: 'short' };
                    const date = yourDate.toLocaleString('en', options);
    
                    details = `Rekening dilaporkan pada *${date}*\nby ${laporan.reporterEmail.replace('*', 'x')}\n\n`
                    details += `${laporan.chronology}\n\n`
                    await bot.sendMessage(chatId, telegramReplacer(details), botOptions);
                };    
            }

            await bot.sendMessage(chatId, 'Kunjungi https://cekrekening.id/home untuk informasi lebih lanjut, melakukan sanggahan atau normalisasi rekening.\n\nBot by https://wafvel.com');

        }
    }

    if (results == 0) {
        await bot.sendMessage(chatId, 'Pengaduan tidak ditemukan, harap tetap waspada dan selalu gunakan pihak ketiga/marketplace.\n\nApabila anda ingin melaporkan rekening ini atas dugaan penipuan, kunjungi https://cekrekening.id/laporkan-rekening\n\nBot by https://wafvel.com');
    }

});
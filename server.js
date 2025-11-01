const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Разрешаем JSON и CORS
app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Простое хранилище в памяти
let storage = {
    letters: [],
    answers: []
};

// Главная страница - проверка работы
app.get('/', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Сервер Почты доверия работает! 🚀',
        timestamp: new Date().toISOString(),
        stats: {
            letters: storage.letters.length,
            answers: storage.answers.length
        }
    });
});

// Сохранить письмо
app.post('/save-letter', (req, res) => {
    try {
        console.log('Получено письмо:', req.body);
        
        const letter = {
            id: Date.now(),
            code: req.body.code,
            category: req.body.category,
            message: req.body.message,
            createdAt: new Date().toISOString()
        };
        
        storage.letters.push(letter);
        
        console.log('Письмо сохранено. Всего писем:', storage.letters.length);
        
        res.json({ 
            success: true, 
            message: 'Письмо сохранено!',
            id: letter.id
        });
        
    } catch (error) {
        console.error('Ошибка сохранения письма:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Получить все письма
app.get('/get-letters', (req, res) => {
    try {
        console.log('Запрос на получение писем');
        res.json({ 
            success: true, 
            data: storage.letters,
            count: storage.letters.length
        });
    } catch (error) {
        console.error('Ошибка получения писем:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Сохранить ответ психолога
app.post('/save-answer', (req, res) => {
    try {
        console.log('Получен ответ:', req.body);
        
        const answer = {
            id: Date.now(),
            code: req.body.code,
            question: req.body.question,
            answer: req.body.answer,
            createdAt: new Date().toISOString()
        };
        
        storage.answers.push(answer);
        
        console.log('Ответ сохранен. Всего ответов:', storage.answers.length);
        
        res.json({ 
            success: true, 
            message: 'Ответ сохранен!',
            id: answer.id
        });
        
    } catch (error) {
        console.error('Ошибка сохранения ответа:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Получить ответ по коду
app.get('/get-answer/:code', (req, res) => {
    try {
        const code = req.params.code;
        console.log('Поиск ответа для кода:', code);
        
        const answer = storage.answers.find(a => a.code === code);
        
        if (answer) {
            console.log('Ответ найден');
            res.json({ success: true, data: answer });
        } else {
            console.log('Ответ не найден');
            res.json({ success: false, message: 'Ответ не найден' });
        }
        
    } catch (error) {
        console.error('Ошибка поиска ответа:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Получить все ответы (для психолога)
app.get('/get-all-answers', (req, res) => {
    try {
        res.json({
            success: true,
            data: storage.answers
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Получить статистику
app.get('/stats', (req, res) => {
    res.json({
        success: true,
        data: {
            letters: storage.letters.length,
            answers: storage.answers.length
        }
    });
});

// Очистить все данные (для тестирования)
app.delete('/clear', (req, res) => {
    storage.letters = [];
    storage.answers = [];
    res.json({ success: true, message: 'Все данные очищены' });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
    console.log(`📧 Готов принимать письма!`);
    console.log(`📍 URL: http://localhost:${PORT}`);
});

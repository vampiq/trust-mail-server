const express = require('express');
const app = express();

// Получаем порт из переменной окружения или используем 3000 по умолчанию
const PORT = process.env.PORT || 3000;

// Supabase конфигурация
const SUPABASE_URL = 'https://fnpjcijpjhammmqolxlz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZucGpjaWpwamhhbW1tcW9seGx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMzEyMDQsImV4cCI6MjA3NzcwNzIwNH0.Ul4W0aTjxuE_wwdmpdengqTk7KB5_fzoiJwvvf5Z7hI';

app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Функции для работы с Supabase через fetch
async function supabaseRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.log('❌ Ошибка Supabase:', error.message);
        throw error;
    }
}

// Проверка подключения к Supabase
async function checkSupabaseConnection() {
    try {
        await supabaseRequest('letters?select=id&limit=1');
        return true;
    } catch (error) {
        return false;
    }
}

// Простое хранилище в памяти как fallback
let memoryStorage = {
    letters: [],
    answers: []
};

// Главная страница
app.get('/', async (req, res) => {
    const isSupabaseConnected = await checkSupabaseConnection();
    
    res.json({ 
        success: true, 
        message: 'Сервер Почты доверия работает!',
        database: isSupabaseConnected ? 'Supabase PostgreSQL' : 'Memory',
        timestamp: new Date().toISOString(),
        port: PORT
    });
});

// Сохранить письмо
app.post('/save-letter', async (req, res) => {
    try {
        const letter = {
            code: req.body.code,
            category: req.body.category,
            message: req.body.message,
            answered: false
        };
        
        console.log('📨 Получено письмо:', letter.code);
        
        // Пытаемся сохранить в Supabase
        if (await checkSupabaseConnection()) {
            try {
                const data = await supabaseRequest('letters', {
                    method: 'POST',
                    headers: {
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(letter)
                });
                
                console.log('✅ Письмо сохранено в Supabase, код:', letter.code);
                
                return res.json({ 
                    success: true, 
                    message: 'Письмо сохранено в базе данных!',
                    id: data[0].id
                });
            } catch (error) {
                if (error.message.includes('duplicate key')) {
                    return res.json({ 
                        success: false, 
                        error: 'Письмо с таким кодом уже существует' 
                    });
                }
                throw error;
            }
        }
        
        // Fallback: сохраняем в память
        const existingLetter = memoryStorage.letters.find(l => l.code === letter.code);
        if (existingLetter) {
            return res.json({ 
                success: false, 
                error: 'Письмо с таким кодом уже существует' 
            });
        }
        
        memoryStorage.letters.push({ 
            ...letter, 
            id: Date.now(),
            created_at: new Date().toISOString()
        });
        
        console.log('⚠️ Письмо сохранено в памяти, код:', letter.code);
        
        res.json({ 
            success: true, 
            message: 'Письмо сохранено (временное хранилище)',
            id: Date.now()
        });
        
    } catch (error) {
        console.error('❌ Ошибка сохранения письма:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Получить все письма
app.get('/get-letters', async (req, res) => {
    try {
        // Пытаемся загрузить из Supabase
        if (await checkSupabaseConnection()) {
            try {
                const data = await supabaseRequest('letters?select=*&order=created_at.desc');
                
                console.log('✅ Загружено писем из Supabase:', data.length);
                return res.json({ 
                    success: true, 
                    data: data,
                    count: data.length
                });
            } catch (error) {
                console.log('❌ Ошибка загрузки писем из Supabase:', error);
            }
        }
        
        // Fallback: загружаем из памяти
        console.log('⚠️ Загружено писем из памяти:', memoryStorage.letters.length);
        res.json({ 
            success: true, 
            data: memoryStorage.letters,
            count: memoryStorage.letters.length
        });
        
    } catch (error) {
        console.error('❌ Ошибка загрузки писем:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Сохранить ответ психолога
app.post('/save-answer', async (req, res) => {
    try {
        const answer = {
            code: req.body.code,
            question: req.body.question,
            answer: req.body.answer,
            psychologist: 'Елена Сергеевна'
        };
        
        console.log('📝 Получен ответ для кода:', answer.code);
        
        // Пытаемся сохранить в Supabase
        if (await checkSupabaseConnection()) {
            try {
                // Сохраняем ответ
                const answerData = await supabaseRequest('answers', {
                    method: 'POST',
                    headers: {
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(answer)
                });
                
                // Помечаем письмо как отвеченное
                await supabaseRequest(`letters?code=eq.${answer.code}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ answered: true })
                });
                
                console.log('✅ Ответ сохранен в Supabase для кода:', answer.code);
                
                return res.json({ 
                    success: true, 
                    message: 'Ответ сохранен в базе данных!',
                    id: answerData[0].id
                });
            } catch (error) {
                console.log('❌ Ошибка сохранения ответа в Supabase:', error);
            }
        }
        
        // Fallback: сохраняем в память
        memoryStorage.answers.push({ 
            ...answer, 
            id: Date.now(),
            created_at: new Date().toISOString()
        });
        
        // Помечаем письмо как отвеченное в памяти
        const letterIndex = memoryStorage.letters.findIndex(l => l.code === answer.code);
        if (letterIndex !== -1) {
            memoryStorage.letters[letterIndex].answered = true;
        }
        
        console.log('⚠️ Ответ сохранен в памяти для кода:', answer.code);
        
        res.json({ 
            success: true, 
            message: 'Ответ сохранен (временное хранилище)',
            id: Date.now()
        });
        
    } catch (error) {
        console.error('❌ Ошибка сохранения ответа:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Получить ответ по коду
app.get('/get-answer/:code', async (req, res) => {
    try {
        const code = req.params.code;
        console.log('🔍 Поиск ответа для кода:', code);
        
        // Пытаемся найти в Supabase
        if (await checkSupabaseConnection()) {
            try {
                const data = await supabaseRequest(`answers?code=eq.${code}&select=*`);
                
                if (data && data.length > 0) {
                    console.log('✅ Ответ найден в Supabase для кода:', code);
                    return res.json({ success: true, data: data[0] });
                }
            } catch (error) {
                console.log('❌ Ошибка поиска в Supabase:', error);
            }
        }
        
        // Fallback: ищем в памяти
        const answer = memoryStorage.answers.find(a => a.code === code);
        
        if (answer) {
            console.log('⚠️ Ответ найден в памяти для кода:', code);
            res.json({ success: true, data: answer });
        } else {
            console.log('📭 Ответ не найден для кода:', code);
            res.json({ success: false, message: 'Ответ не найден' });
        }
        
    } catch (error) {
        console.error('❌ Ошибка поиска ответа:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Получить все ответы
app.get('/get-all-answers', async (req, res) => {
    try {
        // Пытаемся загрузить из Supabase
        if (await checkSupabaseConnection()) {
            try {
                const data = await supabaseRequest('answers?select=*&order=created_at.desc');
                return res.json({ success: true, data: data });
            } catch (error) {
                console.log('❌ Ошибка загрузки ответов из Supabase:', error);
            }
        }
        
        // Fallback: загружаем из памяти
        res.json({ success: true, data: memoryStorage.answers });
        
    } catch (error) {
        console.error('❌ Ошибка загрузки ответов:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Получить статистику
app.get('/stats', async (req, res) => {
    try {
        if (await checkSupabaseConnection()) {
            try {
                const letters = await supabaseRequest('letters?select=*');
                const answers = await supabaseRequest('answers?select=*');
                
                const unanswered = letters.filter(letter => !letter.answered).length;
                
                return res.json({
                    success: true,
                    data: {
                        letters: letters.length,
                        answers: answers.length,
                        unanswered: unanswered
                    }
                });
            } catch (error) {
                console.log('❌ Ошибка статистики Supabase:', error);
            }
        }
        
        // Fallback: статистика из памяти
        const unanswered = memoryStorage.letters.filter(letter => !letter.answered).length;
        
        res.json({
            success: true,
            data: {
                letters: memoryStorage.letters.length,
                answers: memoryStorage.answers.length,
                unanswered: unanswered
            }
        });
        
    } catch (error) {
        console.error('❌ Ошибка статистики:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Запуск сервера - ВАЖНО: привязываем к 0.0.0.0
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📍 Привязан к 0.0.0.0:${PORT}`);
    
    const isConnected = await checkSupabaseConnection();
    if (isConnected) {
        console.log('🎉 Supabase подключен через REST API!');
        console.log('📊 База данных: PostgreSQL');
    } else {
        console.log('⚠️ Используется временное хранилище в памяти');
    }
    
    console.log(`📧 Почта доверия готова к работе!`);
});

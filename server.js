const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;

// Supabase конфигурация (будет работать если таблицы и политики настроены)
const SUPABASE_URL = 'https://fnpjcijpjhammmqolxlz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZucGpjaWpwamhhbW1tcW9seGx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMzEyMDQsImV4cCI6MjA3NzcwNzIwNH0.Ul4W0aTjxuE_wwdmpdengqTk7KB5_fzoiJwvvf5Z7hI';

app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Основное хранилище в памяти (всегда работает)
let storage = {
    letters: [],
    answers: []
};

// Функция для работы с Supabase (опционально)
async function trySupabaseRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'return=representation',
                ...options.headers
            },
            ...options
        });
        
        if (response.ok) {
            return await response.json();
        } else {
            console.log(`⚠️ Supabase: ${response.status} ${response.statusText}`);
            return null;
        }
    } catch (error) {
        console.log('⚠️ Supabase недоступен');
        return null;
    }
}

// Главная страница
app.get('/', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Сервер Почты доверия работает!',
        storage: 'Встроенная база данных',
        letters: storage.letters.length,
        answers: storage.answers.length,
        timestamp: new Date().toISOString()
    });
});

// Сохранить письмо
app.post('/save-letter', async (req, res) => {
    try {
        const letter = {
            code: req.body.code,
            category: req.body.category,
            message: req.body.message,
            answered: false,
            created_at: new Date().toISOString()
        };
        
        console.log('📨 Получено письмо, код:', letter.code);
        
        // Проверяем уникальность кода
        const existingLetter = storage.letters.find(l => l.code === letter.code);
        if (existingLetter) {
            return res.json({ 
                success: false, 
                error: 'Письмо с таким кодом уже существует' 
            });
        }
        
        // Сохраняем в основное хранилище
        storage.letters.push({ 
            ...letter, 
            id: Date.now()
        });
        
        console.log('✅ Письмо сохранено, код:', letter.code, 'Всего:', storage.letters.length);
        
        // Пробуем сохранить в Supabase (в фоне, не блокируем ответ)
        try {
            await trySupabaseRequest('letters', {
                method: 'POST',
                body: JSON.stringify(letter)
            });
        } catch (e) {
            // Игнорируем ошибки Supabase
        }
        
        res.json({ 
            success: true, 
            message: 'Письмо сохранено!',
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
        console.log('📨 Запрос писем, всего в памяти:', storage.letters.length);
        
        // Пробуем загрузить из Supabase и объединить
        try {
            const supabaseLetters = await trySupabaseRequest('letters?select=*&order=created_at.desc');
            if (supabaseLetters && supabaseLetters.length > 0) {
                console.log('📨 Писем в Supabase:', supabaseLetters.length);
                
                // Объединяем, убирая дубликаты
                const allLetters = [...storage.letters];
                supabaseLetters.forEach(supabaseLetter => {
                    if (!allLetters.find(l => l.code === supabaseLetter.code)) {
                        allLetters.push(supabaseLetter);
                    }
                });
                
                return res.json({ 
                    success: true, 
                    data: allLetters,
                    count: allLetters.length
                });
            }
        } catch (e) {
            // Игнорируем ошибки Supabase
        }
        
        // Возвращаем только из памяти
        res.json({ 
            success: true, 
            data: storage.letters,
            count: storage.letters.length
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
            psychologist: 'Елена Сергеевна',
            created_at: new Date().toISOString()
        };
        
        console.log('📝 Получен ответ для кода:', answer.code);
        
        // Сохраняем в основное хранилище
        const existingAnswerIndex = storage.answers.findIndex(a => a.code === answer.code);
        if (existingAnswerIndex !== -1) {
            storage.answers[existingAnswerIndex] = { 
                ...answer, 
                id: Date.now()
            };
        } else {
            storage.answers.push({ 
                ...answer, 
                id: Date.now()
            });
        }
        
        // Помечаем письмо как отвеченное
        const letterIndex = storage.letters.findIndex(l => l.code === answer.code);
        if (letterIndex !== -1) {
            storage.letters[letterIndex].answered = true;
        }
        
        console.log('✅ Ответ сохранен, код:', answer.code);
        
        // Пробуем сохранить в Supabase
        try {
            await trySupabaseRequest('answers', {
                method: 'POST',
                body: JSON.stringify(answer)
            });
            
            await trySupabaseRequest(`letters?code=eq.${answer.code}`, {
                method: 'PATCH',
                body: JSON.stringify({ answered: true })
            });
        } catch (e) {
            // Игнорируем ошибки Supabase
        }
        
        res.json({ 
            success: true, 
            message: 'Ответ сохранен!',
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
        
        // Ищем в основном хранилище
        let answer = storage.answers.find(a => a.code === code);
        
        // Если не нашли, пробуем Supabase
        if (!answer) {
            try {
                const supabaseAnswers = await trySupabaseRequest(`answers?code=eq.${code}&select=*`);
                if (supabaseAnswers && supabaseAnswers.length > 0) {
                    answer = supabaseAnswers[0];
                    // Сохраняем в память для будущих запросов
                    storage.answers.push(answer);
                }
            } catch (e) {
                // Игнорируем ошибки
            }
        }
        
        if (answer) {
            console.log('✅ Ответ найден для кода:', code);
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
        let allAnswers = [...storage.answers];
        
        // Пробуем загрузить из Supabase
        try {
            const supabaseAnswers = await trySupabaseRequest('answers?select=*&order=created_at.desc');
            if (supabaseAnswers) {
                supabaseAnswers.forEach(supabaseAnswer => {
                    if (!allAnswers.find(a => a.code === supabaseAnswer.code)) {
                        allAnswers.push(supabaseAnswer);
                    }
                });
            }
        } catch (e) {
            // Игнорируем ошибки
        }
        
        res.json({ success: true, data: allAnswers });
        
    } catch (error) {
        console.error('❌ Ошибка загрузки ответов:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Получить статистику
app.get('/stats', (req, res) => {
    const unanswered = storage.letters.filter(letter => !letter.answered).length;
    
    res.json({
        success: true,
        data: {
            letters: storage.letters.length,
            answers: storage.answers.length,
            unanswered: unanswered
        }
    });
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📍 Привязан к 0.0.0.0:${PORT}`);
    console.log('📧 Почта доверия готова к работе!');
    console.log('💾 Основное хранилище: встроенная база данных');
    console.log('✅ Все функции работают без внешних зависимостей');
});

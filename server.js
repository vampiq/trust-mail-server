const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const app = express();
const PORT = process.env.PORT || 3000;

// Supabase конфигурация - ВАШИ ДАННЫЕ
const SUPABASE_URL = 'https://fnpjcijpjhammmqolxlz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZucGpjaWpwamhhbW1tcW9seGx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMzEyMDQsImV4cCI6MjA3NzcwNzIwNH0.Ul4W0aTjxuE_wwdmpdengqTk7KB5_fzoiJwvvf5Z7hI';

// Создаем клиент Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Простое хранилище в памяти как fallback
let memoryStorage = {
    letters: [],
    answers: []
};

// Проверка подключения к Supabase
async function checkSupabaseConnection() {
    try {
        const { data, error } = await supabase
            .from('letters')
            .select('id')
            .limit(1);
        
        if (error) {
            console.log('❌ Ошибка Supabase:', error.message);
            return false;
        }
        return true;
    } catch (error) {
        console.log('❌ Supabase недоступен:', error.message);
        return false;
    }
}

// Главная страница
app.get('/', async (req, res) => {
    const isSupabaseConnected = await checkSupabaseConnection();
    
    res.json({ 
        success: true, 
        message: 'Сервер Почты доверия работает!',
        database: isSupabaseConnected ? 'Supabase PostgreSQL' : 'Memory',
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
            answered: false
        };
        
        console.log('📨 Получено письмо:', letter.code);
        
        // Пытаемся сохранить в Supabase
        if (await checkSupabaseConnection()) {
            const { data, error } = await supabase
                .from('letters')
                .insert([letter])
                .select();
            
            if (error) {
                if (error.code === '23505') { // unique violation
                    return res.json({ 
                        success: false, 
                        error: 'Письмо с таким кодом уже существует' 
                    });
                }
                console.log('❌ Ошибка Supabase при сохранении:', error);
                throw error;
            }
            
            console.log('✅ Письмо сохранено в Supabase, код:', letter.code);
            
            return res.json({ 
                success: true, 
                message: 'Письмо сохранено в базе данных!',
                id: data[0].id
            });
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
            const { data, error } = await supabase
                .from('letters')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) {
                console.log('❌ Ошибка загрузки писем из Supabase:', error);
                throw error;
            }
            
            console.log('✅ Загружено писем из Supabase:', data?.length || 0);
            return res.json({ 
                success: true, 
                data: data || [],
                count: data?.length || 0
            });
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
            // Сохраняем ответ
            const { data: answerData, error: answerError } = await supabase
                .from('answers')
                .insert([answer])
                .select();
            
            if (answerError) {
                console.log('❌ Ошибка сохранения ответа в Supabase:', answerError);
                throw answerError;
            }
            
            // Помечаем письмо как отвеченное
            const { error: updateError } = await supabase
                .from('letters')
                .update({ answered: true })
                .eq('code', answer.code);
            
            if (updateError) {
                console.log('⚠️ Не удалось обновить статус письма:', updateError);
            }
            
            console.log('✅ Ответ сохранен в Supabase для кода:', answer.code);
            
            return res.json({ 
                success: true, 
                message: 'Ответ сохранен в базе данных!',
                id: answerData[0].id
            });
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
            const { data, error } = await supabase
                .from('answers')
                .select('*')
                .eq('code', code)
                .single();
            
            if (error && error.code !== 'PGRST116') {
                console.log('❌ Ошибка поиска в Supabase:', error);
                throw error;
            }
            
            if (data) {
                console.log('✅ Ответ найден в Supabase для кода:', code);
                return res.json({ success: true, data: data });
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
            const { data, error } = await supabase
                .from('answers')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            return res.json({ success: true, data: data || [] });
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
            const { data: letters, error: lettersError } = await supabase
                .from('letters')
                .select('*');
            
            const { data: answers, error: answersError } = await supabase
                .from('answers')
                .select('*');
            
            if (lettersError || answersError) throw lettersError || answersError;
            
            const unanswered = letters.filter(letter => !letter.answered).length;
            
            return res.json({
                success: true,
                data: {
                    letters: letters.length,
                    answers: answers.length,
                    unanswered: unanswered
                }
            });
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

// Запуск сервера
app.listen(PORT, async () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    
    const isConnected = await checkSupabaseConnection();
    if (isConnected) {
        console.log('🎉 Supabase подключен!');
        console.log('📊 База данных: PostgreSQL');
    } else {
        console.log('⚠️ Используется временное хранилище в памяти');
    }
    
    console.log(`📧 Почта доверия готова к работе!`);
});

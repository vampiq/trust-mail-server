const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Разрешаем JSON и все запросы
app.use(express.json());

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
    timestamp: new Date().toISOString()
  });
});

// Сохранить письмо
app.post('/save-letter', (req, res) => {
  try {
    const letter = {
      id: Date.now(),
      ...req.body,
      createdAt: new Date().toISOString()
    };
    
    storage.letters.push(letter);
    
    res.json({ 
      success: true, 
      message: 'Письмо сохранено!',
      id: letter.id
    });
    
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Получить все письма
app.get('/get-letters', (req, res) => {
  res.json({ 
    success: true, 
    data: storage.letters,
    count: storage.letters.length
  });
});

// Сохранить ответ психолога
app.post('/save-answer', (req, res) => {
  try {
    const answer = {
      id: Date.now(),
      ...req.body,
      createdAt: new Date().toISOString()
    };
    
    storage.answers.push(answer);
    
    res.json({ 
      success: true, 
      message: 'Ответ сохранен!',
      id: answer.id
    });
    
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Получить ответ по коду
app.get('/get-answer/:code', (req, res) => {
  const code = req.params.code;
  const answer = storage.answers.find(a => a.code === code);
  
  if (answer) {
    res.json({ success: true, data: answer });
  } else {
    res.json({ success: false, message: 'Ответ не найден' });
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

// Запуск сервера
app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
  console.log(`📧 Готов принимать письма!`);
});

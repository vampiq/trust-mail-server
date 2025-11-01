const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Разрешаем все запросы
app.use(express.json());

// Данные будем хранить в памяти
let letters = [];
let answers = [];

// Проверка работы сервера
app.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Сервер Почты доверия работает! 🚀' 
  });
});

// Сохранить письмо
app.post('/save-letter', (req, res) => {
  const letter = {
    id: Date.now(),
    ...req.body,
    date: new Date().toLocaleString('ru-RU')
  };
  
  letters.push(letter);
  res.json({ success: true, message: 'Письмо сохранено!' });
});

// Получить все письма
app.get('/get-letters', (req, res) => {
  res.json({ success: true, data: letters });
});

// Сохранить ответ
app.post('/save-answer', (req, res) => {
  const answer = {
    id: Date.now(),
    ...req.body,
    date: new Date().toLocaleString('ru-RU')
  };
  
  answers.push(answer);
  res.json({ success: true, message: 'Ответ сохранен!' });
});

// Получить ответ по коду
app.get('/get-answer/:code', (req, res) => {
  const code = req.params.code;
  const answer = answers.find(a => a.code === code);
  
  if (answer) {
    res.json({ success: true, data: answer });
  } else {
    res.json({ success: false, message: 'Ответ не найден' });
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});

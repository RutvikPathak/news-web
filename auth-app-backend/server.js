const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();  // Load environment variables

// Initialize app
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

// MongoDB connection for authentication and news storage
mongoose.connect('mongodb://localhost:27017/auth-news-app', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// User schema for authentication
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const User = mongoose.model('User', userSchema);

// Article schema for news storage
const articleSchema = new mongoose.Schema({
  title: String,
  description: String,
  urlToImage: String,
  content: String,
  url: String,
});

const Article = mongoose.model('Article', articleSchema);

// Register route
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();
    res.json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(400).json({ error: 'User registration failed' });
  }
});

// Login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ error: 'Invalid credentials' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET);
  res.json({ token });
});

// Protected route
app.get('/welcome', (req, res) => {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ message: `Welcome, ${decoded.username}!` });
  } catch (error) {
    res.status(400).json({ error: 'Invalid token' });
  }
});

// Fetch and store articles in MongoDB
app.get('/fetch-articles', async (req, res) => {
  try {
    const response = await axios.get('https://newsapi.org/v2/top-headlines', {
      params: {
        country: 'us',
        apiKey: '0203517ab5344207ad132384da88c073',
      },
    });

    const articles = response.data.articles.map((article) => ({
      title: article.title,
      description: article.description,
      urlToImage: article.urlToImage,
      content: article.content,
      url: article.url,
    }));

    // Clear the existing articles and insert the new ones
    await Article.deleteMany({});
    await Article.insertMany(articles);
    res.status(200).json({ message: 'Articles stored successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching articles', error });
  }
});

// Get articles from MongoDB
app.get('/articles', async (req, res) => {
  try {
    const articles = await Article.find();
    res.status(200).json(articles);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving articles', error });
  }
});

// Start the server
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

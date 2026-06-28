const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Inicjalizacja bazy danych SQLite
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error("Błąd bazy:", err.message);
    else {
        console.log("Połączono z bazą SQLite.");
        
        // Włączenie obsługi relacji i kluczy obcych w SQLite
        db.run("PRAGMA foreign_keys = ON;");
        
        // 1. Tabela użytkowników
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL
        )`, () => {
            db.run("INSERT OR IGNORE INTO users (username, password, role) VALUES ('admin', 'admin123', 'admin')");
            db.run("INSERT OR IGNORE INTO users (username, password, role) VALUES ('user', 'user123', 'user')");
        });

        // 2. Tabela książek
        db.run(`CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            description TEXT,
            rating INTEGER,
            genre TEXT,
            cover_url TEXT
        )`);

        // 3. Tabela komentarzy (Relacja: Wiele komentarzy -> Jedna książka)
        db.run(`CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            book_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
        )`);
    }
});

// --- ENDPOINTY AUTORYZACJI ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT id, username, role FROM users WHERE username = ? AND password = ?", [username, password], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(400).json({ error: "Błędny login lub hasło!" });
        res.json(user);
    });
});

app.post('/api/register', (req, res) => {
    const { username, password, role } = req.body;
    db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", [username, password, role || 'user'], function(err) {
        if (err) return res.status(400).json({ error: "Ta nazwa użytkownika jest już zajęta!" });
        res.json({ id: this.lastID, username, role: role || 'user' });
    });
});

// --- ENDPOINTY KATALOGU KSIĄŻEK ---
app.get('/api/books', (req, res) => {
    db.all("SELECT * FROM books", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/books', (req, res) => {
    const { title, author, description, rating, genre, cover_url } = req.body;
    db.run("INSERT INTO books (title, author, description, rating, genre, cover_url) VALUES (?, ?, ?, ?, ?, ?)", 
        [title, author, description, rating, genre, cover_url], 
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, title, author, description, rating, genre, cover_url });
        }
    );
});

app.put('/api/books/:id', (req, res) => {
    const id = req.params.id;
    const { title, author, description, rating, genre, cover_url } = req.body;
    db.run("UPDATE books SET title = ?, author = ?, description = ?, rating = ?, genre = ?, cover_url = ? WHERE id = ?",
        [title, author, description, rating, genre, cover_url, id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ updated: this.changes });
        }
    );
});

app.delete('/api/books/:id', (req, res) => {
    const id = req.params.id;
    db.run("DELETE FROM books WHERE id = ?", id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

// --- ENDPOINTY KOMENTARZY (NOWOŚĆ!) ---
app.get('/api/books/:id/comments', (req, res) => {
    db.all("SELECT * FROM comments WHERE book_id = ? ORDER BY created_at ASC", [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/books/:id/comments', (req, res) => {
    const { username, content } = req.body;
    db.run("INSERT INTO comments (book_id, username, content) VALUES (?, ?, ?)", 
        [req.params.id, username, content], 
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, book_id: req.params.id, username, content });
        }
    );
});

app.listen(port, () => {
    console.log(`Serwer z relacjami (Komentarze) działa na http://localhost:${port}`);
});
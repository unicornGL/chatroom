const express = require("express")
const http = require("http")
const socketIo = require("socket.io")
const cors = require("cors")
const sqlite3 = require("sqlite3")
const { open } = require("sqlite")

const main = async () => {
  const db = await open({
    filename: "chat.db",
    driver: sqlite3.Database,
  })

  await db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_offset TEXT UNIQUE,
      content TEXT
  );
`)

  const app = express()
  app.use(cors())

  const server = http.createServer(app)
  const io = socketIo(server, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"],
    },
  })

  io.on("connection", async (socket) => {
    socket.on("chat message", async (msg) => {
      let result
      try {
        result = await db.run("INSERT INTO messages (content) VALUES (?)", msg)
      } catch (e) {
        console.error("storing message failed", e)
        return
      }

      io.emit("chat message", msg, result.lastID)
    })

    if (!socket.recovered) {
      try {
        await db.each(
          "SELECT id, content FROM messages WHERE id > ?",
          [socket.handshake.auth.serverOffset || 0],
          (_err, row) => {
            socket.emit("chat message", row.content, row.id)
          }
        )
      } catch (e) {
        console.error("Recovering messages failed:", e)
      }
    }
  })

  const PORT = 5001
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`))
}

main()

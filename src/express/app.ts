import express from "express"
import morgan from "morgan"
import cors from "cors"

export const app: express.Application = express()
app.use( morgan("combined") )
app.use( cors() )
app.options( "/{*splat}", cors() )

app.use( express.json({ limit:"1mb" }) )
app.use( express.urlencoded({ extended: true }) )
app.use( express.raw({ limit:"10mb", type:"*/*" }) )

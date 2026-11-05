// prisma.config.ts
import { defineConfig } from '@prisma/config'
import { config } from 'dotenv'

// Prisma実行時に .env.local や .env を手動で読み込ませる
config({ path: '.env.local' })
config({ path: '.env' })

export default defineConfig({
  datasource: {
    // 読み込んだ環境変数の中からURLをセットする
    url: process.env.DATABASE_URL,
  },
})
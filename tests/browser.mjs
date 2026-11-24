import { chromium } from 'playwright'

export const base = (process.env.TEST_BASE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '')
export const launchBrowser = () => chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL })

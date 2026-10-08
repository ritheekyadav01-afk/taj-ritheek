import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import './index.css'
import App from './App'
import { AppProvider } from './store'
import { DEMO } from './api'

// GitHub Pages cannot rewrite deep links, so the demo build routes with #/paths
const Router = DEMO ? HashRouter : BrowserRouter

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <AppProvider>
        <Router>
          <App />
        </Router>
      </AppProvider>
    </MotionConfig>
  </React.StrictMode>,
)

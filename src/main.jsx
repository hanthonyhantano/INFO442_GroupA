import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import LiveNavigation from './navigation/LiveNavigation'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <LiveNavigation>
        <App />
      </LiveNavigation>
    </BrowserRouter>
  </React.StrictMode>
)

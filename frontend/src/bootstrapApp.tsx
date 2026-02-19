import React from 'react'
import { Provider } from 'react-redux'
import App from './App'
import { store } from './features/store'
import { env } from './utils/env'
import './index.css'

void env

export default function BootstrapApp() {
  return (
    <React.StrictMode>
      <Provider store={store}>
        <App />
      </Provider>
    </React.StrictMode>
  )
}

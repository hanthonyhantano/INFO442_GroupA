import { Routes, Route, Navigate } from 'react-router-dom'
import ShopperLayout from './components/ShopperLayout'
import ProducerLayout from './components/ProducerLayout'
import Home from './pages/Home'
import Shop from './pages/Shop'
import ProductPage from './pages/ProductPage'
import ExploreCuts from './pages/ExploreCuts'
import Farms from './pages/Farms'
import FarmPage from './pages/FarmPage'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import RequestSent from './pages/RequestSent'
import Mission from './pages/Mission'
import ForProducers from './pages/ForProducers'
import SignIn from './pages/SignIn'
import Apply from './pages/Apply'
import Today from './pages/producer/Today'
import Orders from './pages/producer/Orders'
import Inventory from './pages/producer/Inventory'
import Batches from './pages/producer/Batches'
import Import from './pages/producer/Import'
import FarmProfile from './pages/producer/FarmProfile'
import './App.css'

export default function App() {
  return (
    <Routes>
      <Route element={<ShopperLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/shop/:cutId" element={<ProductPage />} />
        <Route path="/shop/product/:productId" element={<ProductPage />} />
        <Route path="/explore" element={<ExploreCuts />} />
        <Route path="/farms" element={<Farms />} />
        <Route path="/farms/:farmId" element={<FarmPage />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/request-sent" element={<RequestSent />} />
        <Route path="/mission" element={<Mission />} />
        <Route path="/producers" element={<ForProducers />} />
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/apply" element={<Apply />} />
      </Route>
      <Route path="/producer" element={<ProducerLayout />}>
        <Route index element={<Navigate to="today" replace />} />
        <Route path="today" element={<Today />} />
        <Route path="orders" element={<Orders />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="batches" element={<Batches />} />
        <Route path="import" element={<Import />} />
        <Route path="profile" element={<FarmProfile />} />
      </Route>
    </Routes>
  )
}

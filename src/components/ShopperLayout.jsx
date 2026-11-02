import { Outlet } from 'react-router-dom'

export default function ShopperLayout() {
  return (
    <div>
      {/* shopper nav goes here */}
      <Outlet />
    </div>
  )
}

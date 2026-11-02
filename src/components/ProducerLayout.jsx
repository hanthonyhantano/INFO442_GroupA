import { Outlet } from 'react-router-dom'

export default function ProducerLayout() {
  return (
    <div>
      {/* producer sidebar goes here */}
      <Outlet />
    </div>
  )
}

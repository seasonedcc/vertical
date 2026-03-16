import { DesktopBoard } from './desktop-board'
import { MobileBoard } from './mobile-board'

function Board() {
  return (
    <>
      <MobileBoard />
      <DesktopBoard />
    </>
  )
}

export { Board }

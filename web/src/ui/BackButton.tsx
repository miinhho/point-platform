import { MotionButton, useTapScale } from './motion'

/**
 * 뒤로.
 *
 * 화면마다 다시 만들지 않는다. 위치가 흔들리면 사용자는 매 화면에서 이 버튼을
 * 다시 찾아야 하고, 되돌릴 수 없는 행동을 앞둔 화면에서 그건 그냥 불안이다.
 */
export function BackButton({ onClick }: { onClick: () => void }) {
  const tap = useTapScale()
  return (
    <MotionButton
      type="button"
      aria-label="뒤로"
      whileTap={tap}
      onClick={onClick}
      width="34px"
      height="34px"
      marginLeft="-8px"
      flexShrink={0}
      display="grid"
      placeItems="center"
      fontSize="2xl"
      lineHeight="1"
      color="fg"
    >
      ‹
    </MotionButton>
  )
}

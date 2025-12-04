import { HeroSection } from '../components/landing/HeroSection'
import { DualColumnSection } from '../components/landing/DualColumnSection'
import { CommonContentRow } from '../components/landing/CommonContentRow'
import landingBg from '../assets/images/landingBg.jpg'

const Home = () => {
  return (
    <div style={{
      backgroundImage: `url(${landingBg})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      minHeight: '100vh'
    }}>
        <HeroSection />
        <DualColumnSection />
        <CommonContentRow />
    </div>
  )
}

export default Home
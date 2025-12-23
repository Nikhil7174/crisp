import { HeroSection } from '../components/landing/HeroSection'
import { VideoSection } from '../components/landing/VideoSection'
import { CommonContentRow } from '../components/landing/CommonContentRow'
import CostCalculatorSection from '../components/landing/CostCalculatorSection'
import landingBg from '../assets/images/landingBg.jpg'

const Home = () => {
  return (
    <>
      <div style={{
        backgroundImage: `url(${landingBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        minHeight: '100vh'
      }}>
        <HeroSection />
        <VideoSection />
      </div>
      <CommonContentRow />
      <CostCalculatorSection />
    </>
  )
}

export default Home
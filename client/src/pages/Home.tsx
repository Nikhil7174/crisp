import { HeroSection } from '../components/landing/HeroSection'
import { VideoSection } from '../components/landing/VideoSection'
import { CommonContentRow } from '../components/landing/CommonContentRow'
import CostCalculatorSection from '../components/landing/CostCalculatorSection'
import { FeaturesSection } from '../components/landing/FeaturesSection'
import { ProcessFlowSection } from '../components/landing/ProcessFlowSection'
import { DownloadSection } from '../components/landing/DownloadSection'

const Home = () => {
  return (
    <>
      <div style={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <HeroSection />
        <VideoSection />
      </div>
      <CommonContentRow />
      <CostCalculatorSection />
      <FeaturesSection />
      <ProcessFlowSection />
      <DownloadSection />
    </>
  )
}

export default Home
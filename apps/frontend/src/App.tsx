import Banner from "./components/Banner";
import ChatAssistant from "./components/ChatAssistant";
import Footer from "./components/Footer";
import Header from "./components/Header";
import VideoBanner from "./components/VideoBanner";

import TourismShowcase from "./components/TourismShowcase/TourismShowcase";

function App() {
    return (
        <>
            <Header />
            <VideoBanner
                src="/assets/video/litoral-piaui-cortado.mp4"
                poster="/assets/turismo/delta-ambiental.jpg"
                ariaLabel="Video em loop com imagens de drone do litoral do Piaui"
            />
            <TourismShowcase />
            <Banner src="./assets/turismo/melancieiras.jpg" alt="Paisagem de Melancieiras" />
            <Footer />
            <ChatAssistant />
        </>
    );
}

export default App;

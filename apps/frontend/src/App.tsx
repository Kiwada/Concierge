import Banner from "./components/Banner";
import ChatAssistant from "./components/ChatAssistant";
import Footer from "./components/Footer";
import Header from "./components/Header";
import MovieSection from "./components/MovieSection";
import Newsletter from "./components/Newsletter";
import TourismShowcase from "./components/TourismShowcase/TourismShowcase";

function App() {
    return (
        <>
            <Header />
            <TourismShowcase />
            <Banner src="./assets/turismo/delta-ambiental.jpg" alt="Paisagem do Delta" />
            <MovieSection />
            <Banner src="./assets/turismo/melancieiras.jpg" alt="Paisagem de Melancieiras" />  
            <Newsletter/>      
            <Footer />  
            <ChatAssistant />
        </>
    );
}

export default App;

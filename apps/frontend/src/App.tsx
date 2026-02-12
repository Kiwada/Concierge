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
            <Banner src="./Banner.png" alt="Banner" />
            <MovieSection />
            <Banner src="./combo.png" alt="Combo" />  
            <Newsletter/>      
            <Footer />  
            <ChatAssistant />
        </>
    );
}

export default App;

import axios from 'axios';
import { env } from '../config/env';
import type { Movie } from '../Types/Index';

const MOVIES_ENDPOINT = `${env.apiUrl}/movies`;

export const getMovies = async (): Promise<Movie[]> => {
    const response = await axios.get(MOVIES_ENDPOINT);
    const payload = response.data;

    if (Array.isArray(payload)) {
        return payload as Movie[];
    }

    if (payload && typeof payload === "object" && Array.isArray((payload as { movies?: unknown[] }).movies)) {
        return (payload as { movies: Movie[] }).movies;
    }

    throw new Error("API retornou formato invalido para lista de filmes");
}

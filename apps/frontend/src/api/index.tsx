import axios from 'axios';
import { env } from '../config/env';
import type { Movie } from '../Types/Index';

const MOVIES_ENDPOINT = `${env.apiUrl}/movies`;

export const getMovies = async (): Promise<Movie[]> => {
    const response = await axios.get<Movie[]>(MOVIES_ENDPOINT);
    return response.data;
}

const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ytdl = require('@distube/ytdl-core');
const path = require('path');
const fs = require('fs');

// 1. Configuramos la ruta del binario de FFmpeg (para que funcione sin instalar nada en el OS)
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * YouTube a veces bloquea peticiones con el mensaje "Sign in to confirm you're not a bot".
 * Para evitarlo, puedes exportar las cookies de tu navegador (ya con sesión iniciada)
 * a un archivo llamado "cookies.json" en la raíz del proyecto.
 *
 * Cómo obtenerlas:
 *  1. Instala una extensión como "Get cookies.txt LOCALLY" o "EditThisCookie".
 *  2. En YouTube (con sesión iniciada), exporta las cookies en formato JSON.
 *  3. Guarda ese contenido en cookies.json junto a este script.
 *
 * Si el archivo no existe, el script funciona igual (útil para videos que no requieren verificación).
 */
let agent;
const cookiesPath = path.join(__dirname, 'cookies.json');
if (fs.existsSync(cookiesPath)) {
    try {
        const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
        agent = ytdl.createAgent(cookies);
        console.log('🍪 Cookies cargadas correctamente.');
    } catch (err) {
        console.warn(`⚠️  No se pudieron leer las cookies (${err.message}). Continuando sin ellas.`);
    }
}

/**
 * Limpia el título para usarlo como nombre de archivo válido en Windows/Linux/Mac
 * @param {string} name - Título original del video
 * @returns {string} Nombre seguro para el sistema de archivos
 */
const sanitizeFileName = (name) => {
    return name
        .replace(/[<>:"/\\|?*]+/g, '')   // Caracteres prohibidos
        .replace(/\s+/g, ' ')            // Espacios múltiples a uno
        .trim()
        .slice(0, 120);                  // Evitar nombres demasiado largos
};

/**
 * Descarga un video de YouTube y lo convierte a MP3
 * @param {string} url - Enlace del video de YouTube
 * @param {string} outputFolder - Carpeta donde se guardará (opcional)
 */
const youtubeToMp3 = async (url, outputFolder = './output') => {

    // Validar que el enlace sea de YouTube
    if (!ytdl.validateURL(url)) {
        console.error(`❌ El enlace no es un video de YouTube válido: ${url}`);
        return;
    }

    // Crear carpeta de salida si no existe
    if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
    }

    try {
        // Opciones comunes (incluye el agent con cookies si está disponible)
        const ytdlOptions = agent ? { agent } : {};

        // Obtener información del video para usar el título como nombre
        console.log(`🔍 Obteniendo información del video...`);
        const info = await ytdl.getInfo(url, ytdlOptions);
        const title = sanitizeFileName(info.videoDetails.title);
        const outputPath = path.join(outputFolder, `${title}.mp3`);

        console.log(`🎬 Video: ${info.videoDetails.title}`);
        console.log(`🔄 Iniciando descarga y conversión -> ${outputPath}`);

        // 2. Stream de solo audio (mejor calidad disponible)
        const audioStream = ytdl(url, {
            quality: 'highestaudio',
            filter: 'audioonly',
            ...ytdlOptions,
        });

        audioStream.on('error', (err) => {
            console.error(`\n❌ Error al descargar: ${err.message}`);
        });

        // 3. Convertir el stream a MP3 con FFmpeg
        ffmpeg(audioStream)
            .toFormat('mp3')
            .audioBitrate('192k')
            .audioChannels(2) // Estéreo
            .on('progress', (progress) => {
                const time = progress.timemark || 'calculando';
                process.stdout.write(`⏳ Procesando: ${time} ... \r`);
            })
            .on('error', (err) => {
                console.error(`\n❌ Error al convertir: ${err.message}`);
            })
            .on('end', () => {
                console.log(`\n✅ Conversión completada exitosamente: ${outputPath}`);
            })
            .save(outputPath);

    } catch (err) {
        console.error(`\n❌ Error inesperado: ${err.message}`);
    }
};

// --- USO POR LÍNEA DE COMANDOS ---
// Ejecuta:  node youtube.js "https://www.youtube.com/watch?v=XXXXXXX"
const urlFromArgs = process.argv[2];

if (urlFromArgs) {
    youtubeToMp3(urlFromArgs);
} else {
    // --- EJEMPLO DE USO DIRECTO ---
    // Descomenta y coloca tu enlace:
    // youtubeToMp3('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    console.log('ℹ️  Uso: node youtube.js "<enlace_de_youtube>"');
}

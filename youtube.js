const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const YTDlpWrap = require('yt-dlp-wrap').default;
const path = require('path');
const fs = require('fs');
const os = require('os');

// 1. Configuramos la ruta del binario de FFmpeg (para que funcione sin instalar nada en el OS)
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Ruta local donde guardaremos el binario de yt-dlp (autocontenido en el proyecto)
const binName = os.platform() === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const ytDlpBinaryPath = path.join(__dirname, 'bin', binName);

/**
 * Se asegura de que el binario de yt-dlp exista; si no, lo descarga automáticamente.
 * @returns {Promise<YTDlpWrap>} instancia lista para usar
 */
const ensureYtDlp = async () => {
    const binDir = path.dirname(ytDlpBinaryPath);
    if (!fs.existsSync(binDir)) {
        fs.mkdirSync(binDir, { recursive: true });
    }

    if (!fs.existsSync(ytDlpBinaryPath)) {
        console.log('⬇️  Descargando yt-dlp (solo la primera vez)...');
        await YTDlpWrap.downloadFromGithub(ytDlpBinaryPath);
        console.log('✅ yt-dlp descargado.');
    }

    return new YTDlpWrap(ytDlpBinaryPath);
};

/**
 * Descarga un video de YouTube y lo convierte a MP3 usando yt-dlp + FFmpeg
 * @param {string} url - Enlace del video de YouTube
 * @param {string} outputFolder - Carpeta donde se guardará (opcional)
 */
const youtubeToMp3 = async (url, browser = null, outputFolder = './output') => {

    // Crear carpeta de salida si no existe
    if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
    }

    try {
        const ytDlp = await ensureYtDlp();

        console.log(`🔄 Iniciando descarga y conversión a MP3...`);
        console.log(`🔗 ${url}`);

        // yt-dlp se encarga de descargar el mejor audio y convertirlo a MP3.
        // Usa el FFmpeg que ya tienes instalado vía @ffmpeg-installer.
        // El nombre de salida será el título del video (%(title)s).
        const outputTemplate = path.join(outputFolder, '%(title)s.%(ext)s');

        const args = [
            url,
            '-x',                              // Extraer solo audio
            '--audio-format', 'mp3',           // Formato MP3
            '--audio-quality', '0',            // Mejor calidad (VBR)
            '--ffmpeg-location', ffmpegInstaller.path, // Reutilizamos el FFmpeg del proyecto
            '-o', outputTemplate,
            '--no-playlist',                   // Solo el video del enlace, no la playlist completa
            '--js-runtimes', `node:${process.execPath}`, // Usa el Node actual para descifrar formatos de YouTube
        ];

        // --- Autenticación para evitar "Sign in to confirm you're not a bot" ---
        // Opción A (recomendada): leer cookies directamente del navegador instalado.
        //   Se activa pasando el navegador como 2º argumento: node youtube.js "<url>" chrome
        //   Navegadores válidos: chrome, edge, firefox, brave, opera, vivaldi, chromium
        // Opción B: exportar un archivo cookies.txt a la raíz del proyecto.
        if (browser) {
            args.push('--cookies-from-browser', browser);
            console.log(`🍪 Usando cookies del navegador: ${browser}`);
        } else {
            const cookiesPath = path.join(__dirname, 'cookies.txt');
            if (fs.existsSync(cookiesPath)) {
                args.push('--cookies', cookiesPath);
                console.log('🍪 Usando cookies.txt para autenticación.');
            }
        }

        // Ejecutar yt-dlp mostrando el progreso en tiempo real
        await new Promise((resolve, reject) => {
            ytDlp.exec(args)
                .on('progress', (progress) => {
                    const percent = progress.percent != null ? `${progress.percent}%` : '...';
                    const speed = progress.currentSpeed || '';
                    process.stdout.write(`⏳ Descargando: ${percent} ${speed}          \r`);
                })
                .on('ytDlpEvent', (eventType, eventData) => {
                    // Mostrar mensajes relevantes de la fase de conversión
                    if (eventType === 'ExtractAudio' || /Destination|Converting/i.test(eventData)) {
                        // silencioso; se resume al final
                    }
                })
                .on('error', (err) => reject(err))
                .on('close', () => resolve());
        });

        console.log(`\n✅ Conversión completada. Revisa la carpeta: ${path.resolve(outputFolder)}`);

    } catch (err) {
        const msg = err && err.message ? err.message : String(err);
        console.error(`\n❌ Error: ${msg}`);

        if (/Sign in to confirm|not a bot|403|Forbidden/i.test(msg)) {
            console.error('\n💡 YouTube está pidiendo verificación. Solución:');
            console.error('   1. Instala la extensión "Get cookies.txt LOCALLY" en tu navegador.');
            console.error('   2. Con tu sesión de YouTube abierta, exporta las cookies.');
            console.error('   3. Guarda el archivo como "cookies.txt" en la raíz de este proyecto.');
            console.error('   4. Vuelve a ejecutar el script.');
        }
    }
};

// --- USO POR LÍNEA DE COMANDOS ---
// Ejecuta:  node youtube.js "https://www.youtube.com/watch?v=XXXXXXX" [navegador]
// Ejemplos:
//   node youtube.js "https://youtu.be/XXXX"            (sin cookies)
//   node youtube.js "https://youtu.be/XXXX" chrome     (cookies desde Chrome)
//   node youtube.js "https://youtu.be/XXXX" edge       (cookies desde Edge)
const urlFromArgs = process.argv[2];
const browserFromArgs = process.argv[3] || null;

if (urlFromArgs) {
    youtubeToMp3(urlFromArgs, browserFromArgs);
} else {
    console.log('ℹ️  Uso: node youtube.js "<enlace_de_youtube>" [navegador]');
    console.log('   Navegadores: chrome, edge, firefox, brave, opera, vivaldi');
    console.log('   Ejemplo: node youtube.js "https://youtu.be/XXXX" chrome');
}

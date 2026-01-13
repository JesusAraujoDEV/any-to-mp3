const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const path = require('path');
const fs = require('fs');

// 1. Configuramos la ruta del binario de FFmpeg (para que funcione sin instalar nada en el OS)
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Convierte cualquier archivo multimedia a MP3
 * @param {string} inputFile - Ruta del archivo de origen (ej: video.mp4, audio.ogg)
 * @param {string} outputFolder - Carpeta donde se guardará (opcional)
 */
const convertToMp3 = (inputFile, outputFolder = './output') => {
    
    // Validar que el archivo existe
    if (!fs.existsSync(inputFile)) {
        console.error(`❌ El archivo ${inputFile} no existe.`);
        return;
    }

    // Crear carpeta de salida si no existe
    if (!fs.existsSync(outputFolder)){
        fs.mkdirSync(outputFolder);
    }

    // Obtener el nombre del archivo sin la extensión original
    const fileName = path.parse(inputFile).name;
    const outputPath = path.join(outputFolder, `${fileName}.mp3`);

    console.log(`🔄 Iniciando conversión: ${inputFile} -> ${outputPath}`);

    // 2. Configuración de FFmpeg
    ffmpeg(inputFile)
        .toFormat('mp3')
        // Opcional: Ajustar calidad de audio (128k, 192k, 320k)
        .audioBitrate('192k') 
        .audioChannels(2) // Estéreo
        
        // Eventos para monitorear el proceso
        .on('progress', (progress) => {
            // Nota: 'percent' puede ser indefinido en algunos formatos, usamos timemark como respaldo
            const percent = progress.percent ? progress.percent.toFixed(2) : 'calculando';
            process.stdout.write(`⏳ Procesando: ${percent}% completado... \r`);
        })
        .on('error', (err) => {
            console.error(`\n❌ Error al convertir: ${err.message}`);
        })
        .on('end', () => {
            console.log(`\n✅ Conversión completada exitosamente: ${outputPath}`);
        })
        
        // 3. Guardar archivo
        .save(outputPath);
};

// --- EJEMPLO DE USO ---

// Puedes probar con diferentes formatos:
// convertToMp3('mi_video.mp4');
// convertToMp3('grabacion.mkv');
convertToMp3('audio_whatsapp.ogg');
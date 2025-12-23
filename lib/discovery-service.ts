import ExifReader from 'exifreader';

export interface SessionDraft {
    date: string;
    startTime: string;
    endTime: string;
    initialCatch?: any;
}

/**
 * Extrait la date et calcule le créneau horaire +/- 1h
 */
export const extractSessionDraft = async (file: File): Promise<SessionDraft> => {
    const tags = await ExifReader.load(file);
    let dateStr = new Date().toISOString().split('T')[0];
    let timeStr = "12:00";

    if (tags['DateTimeOriginal']) {
        const exifDate = tags['DateTimeOriginal'].description; // format "YYYY:MM:DD HH:mm:ss"
        const [d, t] = exifDate.split(' ');
        dateStr = d.replace(/:/g, '-');
        const [h, m] = t.split(':');
        timeStr = `${h}:${m}`;
    }

    // Calcul H-1 et H+1
    const [h, m] = timeStr.split(':').map(Number);
    const startH = Math.max(0, h - 1);
    const endH = Math.min(23, h + 1);
    
    const format = (num: number) => num.toString().padStart(2, '0');

    return {
        date: dateStr,
        startTime: `${format(startH)}:${format(m)}`,
        endTime: `${format(endH)}:${format(m)}`
    };
};
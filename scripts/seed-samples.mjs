// Downloads 8 sample photos of Paris from Wikimedia Commons into /photos-raw,
// writes GPS + date into their EXIF (like a phone would), and creates sample articles.
// Run once with: npm run seed-samples   then: npm run import-photos
import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import piexif from 'piexifjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const RAW = path.join(ROOT, 'photos-raw');
const ARTICLES = path.join(ROOT, 'src', 'articles');
const UA = 'ParisThroughOurLens/1.0 (student study-group demo)';

const SAMPLES = [
  {
    id: 'sacre-coeur', commons: 'File:Le sacre coeur.jpg', lat: 48.8862, lng: 2.343, taken: '2026:10:17 08:40:00',
    title: 'Morning on the Butte', author: 'Matt',
    body: `We started at the bottom of the steps just after eight, before the tourist buses arrived. From here the white basilica looks almost unreal in the early light.\n\nThe Sacré-Cœur was built between 1875 and 1914 with travertine stone that **whitens with rain**, which is why it never looks dirty. Turn around at the top of the stairs: the whole city spreads out below, and it's the best place to plan the rest of the walk.`,
  },
  {
    id: 'canal-saint-martin', commons: 'File:Canal Saint-Martin from Quay de Valmy, Paris, 2016.jpg', lat: 48.8716, lng: 2.3646, taken: '2026:10:17 10:05:00',
    title: 'Iron Bridges over Green Water', author: 'Inès',
    body: `Walking down from Montmartre, we reached the Canal Saint-Martin and its iron footbridges. The canal opened in 1825 to bring fresh water to Paris. Today it's where locals sit with coffee and watch the boats go through the locks.\n\nWe waited for a boat to pass through the lock. It took almost fifteen minutes, so this is a good place to slow down.`,
  },
  {
    id: 'notre-dame', commons: 'File:Notre-Dame de Paris, 4 October 2017.jpg', lat: 48.853, lng: 2.3472, taken: '2026:10:17 11:30:00',
    title: 'The Heart of the City', author: 'Yanis',
    body: `In front of Notre-Dame there is a small bronze star in the ground: **Point Zéro**. All road distances in France are measured from here.\n\nAfter the 2019 fire and five years of restoration, the cathedral reopened in December 2024. Look up at the west front: the three portals tell stories in stone for people who couldn't read.`,
  },
  {
    id: 'pantheon', commons: 'File:Pantheon of Paris 007.JPG', lat: 48.8467, lng: 2.3442, taken: '2026:10:17 12:45:00',
    title: 'To Great Men, a Grateful Nation', author: 'Chloé',
    body: `We walked up rue Soufflot in the Latin Quarter, and the Panthéon's dome got bigger with every step. The words over the entrance read *"Aux grands hommes, la patrie reconnaissante"*.\n\nInside lie Voltaire, Victor Hugo, Marie Curie and Joséphine Baker. Foucault's pendulum, which proved that the Earth turns, still swings under the dome.`,
  },
  {
    id: 'louvre', commons: 'File:Louvre Museum Wikimedia Commons.jpg', lat: 48.861, lng: 2.3358, taken: '2026:10:17 14:20:00',
    title: 'Glass Among Stone', author: 'Matt',
    body: `I. M. Pei's glass pyramid opened in 1989 and many Parisians hated it at first. Now it's one of the most photographed places in the city.\n\nWe got here at lunchtime, when the fountains reflect the old palace walls. A little trick: crouch down near the water and the pyramid seems to float.`,
  },
  {
    id: 'pont-alexandre-iii', commons: 'File:Pont Alexandre III depuis pont de la Concorde Paris.jpg', lat: 48.8638, lng: 2.3185, taken: '2026:10:17 15:50:00',
    title: 'Gold on the Seine', author: 'Inès',
    body: `Seen from the Pont de la Concorde, the Pont Alexandre III shines with its golden Pegasus statues. It was built for the 1900 World's Fair as a symbol of friendship between France and Russia.\n\nIt's made of a single steel arch, kept low on purpose so it wouldn't block the view of the Invalides.`,
  },
  {
    id: 'arc-de-triomphe', commons: 'File:Arc de Triomphe - Août 2026.jpg', lat: 48.8726, lng: 2.2985, taken: '2026:10:17 17:10:00',
    title: 'Twelve Avenues, One Arch', author: 'Yanis',
    body: `At the top of the Champs-Élysées, twelve avenues meet around the Arc de Triomphe, and the traffic has no lanes at all.\n\nUnder the arch is the Tomb of the Unknown Soldier. Its flame has been relit every evening at 6:30 pm since 1923. We stayed to watch the ceremony. It was short, quiet and very moving.`,
  },
  {
    id: 'eiffel-tower', commons: 'File:Tour Eiffel Wikimedia Commons.jpg', lat: 48.8556, lng: 2.2986, taken: '2026:10:17 18:35:00',
    title: 'The Iron Lady at Dusk', author: 'Chloé',
    body: `We ended the walk where everyone ends: the Champ de Mars, with the tower turning gold in the last light.\n\nThe Eiffel Tower was meant to stand for only 20 years. It was saved because it was useful as a radio antenna. Every evening it sparkles for five minutes at the start of each hour. We stayed for the 7 pm show.`,
  },
];

function toExifGps(lat, lng, taken) {
  const gps = {
    [piexif.GPSIFD.GPSLatitudeRef]: lat >= 0 ? 'N' : 'S',
    [piexif.GPSIFD.GPSLatitude]: piexif.GPSHelper.degToDmsRational(Math.abs(lat)),
    [piexif.GPSIFD.GPSLongitudeRef]: lng >= 0 ? 'E' : 'W',
    [piexif.GPSIFD.GPSLongitude]: piexif.GPSHelper.degToDmsRational(Math.abs(lng)),
  };
  const exif = { [piexif.ExifIFD.DateTimeOriginal]: taken };
  return piexif.dump({ '0th': {}, Exif: exif, GPS: gps });
}

const strip = (html = '') => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

async function commonsInfo(title) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  Object.entries({
    action: 'query', format: 'json', titles: title, prop: 'imageinfo',
    iiprop: 'url|extmetadata', iiurlwidth: '2000',
  }).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  const page = Object.values((await res.json()).query.pages)[0];
  const info = page.imageinfo[0];
  return {
    src: info.thumburl || info.url,
    page: info.descriptionurl,
    artist: strip(info.extmetadata?.Artist?.value) || 'Unknown',
    license: strip(info.extmetadata?.LicenseShortName?.value) || '',
  };
}

await fs.mkdir(RAW, { recursive: true });
await fs.mkdir(ARTICLES, { recursive: true });

async function download(url) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return res;
    if (res.status !== 429 && res.status < 500) throw new Error(`Download failed (${res.status}): ${url}`);
    await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
  }
  throw new Error(`Download failed after retries: ${url}`);
}

for (const s of SAMPLES) {
  const rawPath = path.join(RAW, `${s.id}.jpg`);
  if (existsSync(rawPath) && existsSync(path.join(ARTICLES, `${s.id}.md`))) {
    console.log(`• ${s.id} (already there)`);
    continue;
  }
  const info = await commonsInfo(s.commons);
  const res = await download(info.src);
  const jpeg = Buffer.from(await res.arrayBuffer()).toString('binary');
  const withExif = piexif.insert(toExifGps(s.lat, s.lng, s.taken), jpeg);
  await fs.writeFile(rawPath, Buffer.from(withExif, 'binary'));

  const md = `---\ntitle: ${s.title}\nauthor: ${s.author}\n---\n\n${s.body}\n\n<p class="credit">Sample photo: <a href="${info.page}" target="_blank" rel="noreferrer">${info.artist}</a>, ${info.license}, via Wikimedia Commons.</p>\n`;
  await fs.writeFile(path.join(ARTICLES, `${s.id}.md`), md);
  console.log(`✓ ${s.id}`);
}
console.log('\nDone. Now run: npm run import-photos');

import { Manga, MangaSearchResult } from '../types';

// Using MangaDex API as it's free and doesn't require authentication
const MANGADEX_API = 'https://api.mangadex.org';

export async function searchManga(query: string): Promise<MangaSearchResult[]> {
  try {
    // Use MangaDex search endpoint which searches both title and altTitles
    const response = await fetch(
      `${MANGADEX_API}/manga?title=${encodeURIComponent(query)}&limit=20&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&order[relevance]=desc`
    );
    const data = await response.json();
    
    if (!data.data || !Array.isArray(data.data)) {
      console.log('MangaDex search returned no results for:', query);
      return [];
    }
    
    console.log(`MangaDex search found ${data.data.length} results for:`, query);
    
    return data.data.map((manga: any) => {
      const coverArt = manga.relationships?.find((rel: any) => rel.type === 'cover_art');
      const coverFileName = coverArt?.attributes?.fileName;
      // Use larger image size for better quality
      const coverImage = coverFileName 
        ? `https://uploads.mangadex.org/covers/${manga.id}/${coverFileName}.512.jpg`
        : undefined;

      // Get title - try multiple languages
      const title = manga.attributes.title.en || 
                    manga.attributes.title.ja || 
                    manga.attributes.title.ko ||
                    manga.attributes.title['zh-hans'] ||
                    manga.attributes.title['zh-hant'] ||
                    Object.values(manga.attributes.title)[0] || 
                    'Unknown Title';

      // Get altTitles for better matching
      const altTitles = manga.attributes.altTitles || [];
      const allTitles = [title, ...altTitles.map((alt: any) => 
        alt.en || alt.ja || alt.ko || Object.values(alt)[0]
      ).filter(Boolean)];

      return {
        id: manga.id,
        title,
        coverImage,
        description: manga.attributes.description?.en || 
                     manga.attributes.description?.ja || 
                     Object.values(manga.attributes.description || {})[0] || 
                     undefined,
        // Store altTitles for better matching
        altTitles: allTitles,
      };
    });
  } catch (error) {
    console.error('Error searching manga:', error);
    return [];
  }
}

// Search manga by tag/genre
export async function searchMangaByTag(tagName: string): Promise<MangaSearchResult[]> {
  try {
    // First, get all tags and find matching one
    const tagResponse = await fetch(`${MANGADEX_API}/manga/tag`);
    const tagData = await tagResponse.json();
    
    if (!tagData.data || !Array.isArray(tagData.data)) {
      console.log(`No tags found in MangaDex`);
      return [];
    }
    
    // Find matching tag by name (case-insensitive)
    const tagNameLower = tagName.toLowerCase();
    const matchingTag = tagData.data.find((tag: any) => {
      const tagNames = [
        tag.attributes.name.en,
        tag.attributes.name.ja,
        tag.attributes.name.ko,
        ...Object.values(tag.attributes.name || {})
      ].filter(Boolean).map((n: string) => n.toLowerCase());
      return tagNames.some(n => n.includes(tagNameLower) || tagNameLower.includes(n));
    });
    
    if (!matchingTag) {
      console.log(`No tag found matching: ${tagName}`);
      return [];
    }
    
    const tagId = matchingTag.id;
    
    // Search manga with this tag
    const response = await fetch(
      `${MANGADEX_API}/manga?includedTags[]=${tagId}&limit=20&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&order[rating]=desc`
    );
    const data = await response.json();
    
    if (!data.data || !Array.isArray(data.data)) {
      return [];
    }
    
    return data.data.map((manga: any) => {
      const coverArt = manga.relationships?.find((rel: any) => rel.type === 'cover_art');
      const coverFileName = coverArt?.attributes?.fileName;
      const coverImage = coverFileName 
        ? `https://uploads.mangadex.org/covers/${manga.id}/${coverFileName}.512.jpg`
        : undefined;

      const title = manga.attributes.title.en || 
                    manga.attributes.title.ja || 
                    manga.attributes.title.ko ||
                    manga.attributes.title['zh-hans'] ||
                    manga.attributes.title['zh-hant'] ||
                    Object.values(manga.attributes.title)[0] || 
                    'Unknown Title';

      const altTitles = manga.attributes.altTitles || [];
      const allTitles = [title, ...altTitles.map((alt: any) => 
        alt.en || alt.ja || alt.ko || Object.values(alt)[0]
      ).filter(Boolean)];

      return {
        id: manga.id,
        title,
        coverImage,
        description: manga.attributes.description?.en || 
                     manga.attributes.description?.ja || 
                     Object.values(manga.attributes.description || {})[0] || 
                     undefined,
        altTitles: allTitles,
      };
    });
  } catch (error) {
    console.error(`Error searching manga by tag ${tagName}:`, error);
    return [];
  }
}

export async function getMangaDetails(id: string): Promise<Manga | null> {
  try {
    const response = await fetch(
      `${MANGADEX_API}/manga/${id}?includes[]=cover_art&includes[]=author&includes[]=artist`
    );
    const data = await response.json();
    
    if (!data.data) return null;

    const manga = data.data;
    const coverArt = manga.relationships?.find((rel: any) => rel.type === 'cover_art');
    const coverFileName = coverArt?.attributes?.fileName;
    const coverImage = coverFileName 
      ? `https://uploads.mangadex.org/covers/${manga.id}/${coverFileName}.512.jpg`
      : undefined;

    const author = manga.relationships?.find((rel: any) => rel.type === 'author');
    const artist = manga.relationships?.find((rel: any) => rel.type === 'artist');

    // Get chapter count
    const chaptersResponse = await fetch(
      `${MANGADEX_API}/manga/${id}/aggregate?translatedLanguage[]=en`
    );
    const chaptersData = await chaptersResponse.json();
    const totalChapters = chaptersData.volumes 
      ? Object.values(chaptersData.volumes).reduce((acc: number, vol: any) => {
          return acc + Object.keys(vol.chapters || {}).length;
        }, 0)
      : 0;

    return {
      id: manga.id,
      title: manga.attributes.title.en || 
             manga.attributes.title.ja || 
             Object.values(manga.attributes.title)[0] || 
             'Unknown Title',
      description: manga.attributes.description?.en || 
                   manga.attributes.description?.ja || 
                   Object.values(manga.attributes.description || {})[0] || 
                   undefined,
      coverImage,
      status: manga.attributes.status,
      chapters: totalChapters,
      author: author?.attributes?.name || artist?.attributes?.name || undefined,
      genres: manga.attributes.tags
        ?.filter((tag: any) => tag.attributes.group === 'genre')
        ?.map((tag: any) => tag.attributes.name.en || tag.attributes.name.ja) || [],
    };
  } catch (error) {
    console.error('Error fetching manga details:', error);
    return null;
  }
}


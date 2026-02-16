export interface StickerSubcategory {
	id: string;
	name: string;
	path: string;
	sprites: string[];
	count: number;
}

export interface StickerCategory {
	id: string;
	name: string;
	path?: string;
	sprites?: string[];
	subcategories?: StickerSubcategory[];
	count: number;
}

export interface StickerCharacter {
	name: string;
	path: string;
	thumbnail: string;
}

export interface StickerCollection {
	id: string;
	name: string;
	basePath: string;
	categories: StickerCategory[];
	characters: StickerCharacter[];
	count: number;
}

export interface StickerManifest {
	collections: StickerCollection[];
}

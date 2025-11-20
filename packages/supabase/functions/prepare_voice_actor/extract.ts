import { RecursiveSection } from './toc.ts'
import { Categorymember, ElementType, FullElement, ResponseParseText } from './models.ts'
import { acceptedDubbingSubSectionGames, acceptedDubbingSubSectionGenericDubbing, acceptedDubbingSubSectionMovie, acceptedDubbingSubSections, acceptedDubbingSubSectionShows, parseDubberPageAsWikitext } from '../_shared/extract/constants.ts';
import { wikipediaCache } from '../_shared/index.ts';

const makeUniqueIndex = (pageId: string, sectionIndex: string) => {
    return `${pageId}_${sectionIndex}`;
};

const extractMatchingSection = async (
    sectionIndex: string,
    toc: Map<string, RecursiveSection>,
    element: Categorymember
) => {
    console.info("extracting section infos");

    const section = toc.get(sectionIndex);

    if (!section) {
        console.error("section not found");
        return;
    }

    let type: ElementType | undefined;
    if (section.line.match(acceptedDubbingSubSectionMovie)) {
        type = "movie";
    } else if (section.line.match(acceptedDubbingSubSectionShows)) {
        type = "show";
    } else if (section.line.match(acceptedDubbingSubSectionGames)) {
        type = "videogame";
    } else if (section.line.match(acceptedDubbingSubSectionGenericDubbing)) {
        type = "generic";
    } else {
        console.error("type", section.line, "not recognized");
        return;
    }

    // Use cached Wikipedia page content fetch
    const responseParseSection = await wikipediaCache.getPageContentAsWikitext(element.pageid, sectionIndex) as ResponseParseText;

    if (!responseParseSection?.parse) {
        console.error(responseParseSection, element.pageid, sectionIndex);
        return undefined
    } else {
        const result = {
            pageId: element.pageid,
            title: responseParseSection.parse.title,
            html: responseParseSection.parse.wikitext,
            type,
        }
        console.log('------------- ', result)
        return result
    }
};


export const exploreDubbingSectionChilds = async (
    dubbingSectionIndex: string,
    toc: Map<string, RecursiveSection>,
    element: Categorymember
) => {
    const results: unknown[] = []
    const sectionToExplore = toc.get(dubbingSectionIndex);
    if (!sectionToExplore) {
        return [];
    }

    console.info("exploring section", sectionToExplore.line);

    const sectionLength = sectionToExplore.sections?.length ?? 0;
    if (sectionLength === 0) {
        console.info("there are no more sections");
        // there are no subsections
        const result = await extractMatchingSection(dubbingSectionIndex, toc, element);
        if (result) {
            results.push(result)
        }
    } else if (sectionToExplore.sections) {
        console.info("there are more sections !");
        for (const section of sectionToExplore.sections) {
            const isAcceptedDubbingSubSection = acceptedDubbingSubSections.some(
                (regex) => section.line.match(regex)
            );

            if (isAcceptedDubbingSubSection) {
                console.info("found section ", section.line);
                const internalResults = await exploreDubbingSectionChilds(section.index, toc, element);
                if (internalResults) {
                    results.push(...internalResults)
                }
            } else {
                console.error("section", section.line, "not matching criterias");
            }
        }
    }
    return results
};
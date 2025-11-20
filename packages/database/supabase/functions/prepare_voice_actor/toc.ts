import { Section } from "./models.ts";

export interface RecursiveSection extends Section {
  sections?: RecursiveSection[];
}

export const flatTocToTree = (sections: Section[]): Map<string, RecursiveSection> => {
  const newSections: Map<string, RecursiveSection> = new Map<
    string,
    RecursiveSection
  >();
  let path: string[] = []; // 0 is root

  let level = sections[0].toclevel;
  for (const section of sections) {
    // console.log("entering section", section.index);
    // insert section into map
    newSections.set(section.index, section);

    // console.log("level vs section.toclevel", level, section.toclevel);

    // check difference
    const difference = Math.abs(section.toclevel - level);
    // console.log("difference is", difference);
    if (difference > 1) {
      console.error("Difference must not be greater than 1");
    }

    // manage path
    if (section.toclevel > level) {
    //   console.log("pushing path", section.index);
      path.push(section.index);
    } else if (section.toclevel < level) {
    //   console.log(
    //     "removing",
    //     difference,
    //     "element from path and including",
    //     section.index
    //   );
      path = [...path.slice(0, -(difference + 1)), section.index];
    } else if (section.toclevel === level) {
    //   console.log("same level, replacing last one with", section.index);
      path = [...path.slice(0, -1), section.index];
    }
    // console.log("new path", path);
    // console.log("number", section.number);
    // remember last level
    level = section.toclevel;

    // link section to its parent
    const lastPath = path.at(-2); // -2 because last one minus self
    // console.log("lastPath", lastPath);
    if (lastPath && lastPath !== section.index) {
      const foundSection = newSections.get(lastPath);
      //   console.log("foundSection", foundSection);
      if (foundSection) {
        // console.log("adding section", section.index, "to", "section", lastPath);
        newSections.set(lastPath, {
          ...foundSection,
          sections: [...(foundSection?.sections ?? []), section],
        });
      }
    }
    // console.log("");
  }

//   console.log(JSON.stringify([...newSections.values()]));

  return newSections
};

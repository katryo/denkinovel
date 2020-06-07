import { CSSTransition } from 'react-transition-group';
import { Howl, Howler } from 'howler';
import { useState, useEffect, useCallback } from 'react';

const TRANSITION_MS = 2000;
const PAGE_TRAINSITION_MS = 400;
const DEFAULT_CURRENT_MUSIC_ID = -1;

const sleep = async (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

interface Section {
  paragraphs: string[];
  music: string;
  sound: string;
  filter: string;
  bg: string;
  image: string;
  id: number;
}

interface IPageId {
  pageId: number;
}

type SectionWithPageId = Section & IPageId;

interface Page {
  sections: Section[];
  id: number;
}

interface Episode {
  seriesTitle: string;
  episodeTitle: string;
  creator: string;
  pages: Page[];
  audioMapping: { [key: string]: string };
  imageMapping: { [key: string]: string };
  colorMapping: { [key: string]: string };
  defaultBg: string;
  defaultFilter: string;
  defaultTextColor: string;
}

const Paragraph = (props) => {
  const { keyVal, text } = props;
  if (text === '') {
    return (
      <p
        key={keyVal}
        style={{
          margin: 0,
        }}
      >
        <br />
      </p>
    );
  } else {
    return (
      <p key={keyVal} style={{ margin: 0 }}>
        {text}
      </p>
    );
  }
};

const idToSectionId = (id: number) => {
  return `section${id}`;
};

const idToPageId = (id: number) => {
  return `page${id + 1}`;
};

const PageList = (props) => {
  const { pages, currentPage, isPageShowing, textColor } = props;
  const sections = pages.map((page) => {
    const sectionList = page.sections.map((section) => {
      return (
        <div id={idToSectionId(section.id)} key={section.id} style={{ color: textColor }}>
          {section.paragraphs.map((paragraph, idx) => {
            const keyVal = `${section.id}-${idx.toString()}`;
            return <Paragraph keyVal={keyVal} key={keyVal} text={paragraph} />;
          })}
        </div>
      );
    });
    return (
      <CSSTransition
        in={currentPage === page.id && isPageShowing}
        appear={true}
        timeout={TRANSITION_MS}
        classNames="page"
        key={page.id}
        id={idToPageId(page.id)}
      >
        <div className="page-before">{sectionList}</div>
      </CSSTransition>
    );
  });

  return <div>{sections}</div>;
};

interface SectionIdDist {
  [id: number]: number;
}

const StoryContainer = (props: { episode: Episode }) => {
  const { episode } = props;
  const sections: SectionWithPageId[] = episode.pages
    .map((page) => {
      return page.sections.map((section) => {
        return { ...section, pageId: page.id };
      });
    })
    .flat();

  const getColor = (name: string) => {
    const color = episode.colorMapping[name];
    if (!color) {
      throw new Error(`${name} not found in colorMapping.`);
    }
    return color;
  };

  const getVisualSrc = (name: string) => {
    const color = episode.colorMapping[name];
    if (color) {
      return color;
    }
    const imgSrc = episode.imageMapping[name];
    if (imgSrc) {
      return imgSrc;
    }
    throw new Error(`${name} not found in colorMapping nor imageMapping.`);
  };

  const defaultBg = getVisualSrc(episode.defaultBg);

  const [lowerBGColor, setLowerBgSrc] = useState(defaultBg);
  const [upperBGColor, setUpperBgSrc] = useState(defaultBg);
  const [textColor, setTextColor] = useState(getColor(episode.defaultTextColor));
  const [upperBGIn, setUpperBgIn] = useState(false);
  const [currentPage, setPage] = useState(0);
  const [isPageShowing, setIsPageShowing] = useState(true);
  let currentBg = defaultBg;
  const ID_STORY_CONTAINER = 'js-story-container';
  const sectionIdDist: SectionIdDist = {};
  const sectionIdIndex: { [id: number]: number } = {};
  let effectBeginsHeight = 500;

  const getSectionsY = () => {
    const storyContainer = document.getElementById(ID_STORY_CONTAINER);
    const storyContainerTop = storyContainer.getBoundingClientRect().top;
    sections.map((section, idx) => {
      const id = idToSectionId(section.id);
      const elem = document.getElementById(id);
      const rect = elem.getBoundingClientRect();
      sectionIdDist[section.id] = rect.top - storyContainerTop;
      sectionIdIndex[section.id] = idx;
    });

    effectBeginsHeight = window.innerHeight / 2;
  };

  const handleScroll = useCallback(
    async (e) => {
      const sectionId = getCurrentSectionId();
      const sectionIndex = sectionIdIndex[sectionId];
      const currentSection = sections[sectionIndex];
      if (currentSection.pageId !== currentPage) {
        setIsPageShowing(false);
        setPage(currentSection.pageId);
        await sleep(PAGE_TRAINSITION_MS);
        setIsPageShowing(true);
      }
    },
    [currentPage, isPageShowing],
  );

  useEffect(() => {
    getSectionsY();

    document.addEventListener('scroll', handleScroll);
    document.addEventListener('resize', getSectionsY);
    return () => {
      document.removeEventListener('scroll', handleScroll);
      document.removeEventListener('resize', getSectionsY);
    };
  });

  const getCurrentSectionId = () => {
    if (sections.length === 0) {
      return -1;
    }
    const firstId = sections[0].id;
    const scrollTop = document.documentElement.scrollTop;
    const cur = { id: firstId, top: 0 };
    for (const key in sectionIdDist) {
      if (sectionIdDist.hasOwnProperty(key)) {
        const topThreshold = sectionIdDist[key] - effectBeginsHeight;
        if (topThreshold <= scrollTop && (!cur || cur.top < topThreshold)) {
          cur.id = Number(key);
          cur.top = topThreshold;
        }
      }
    }
    if (!cur) {
      return -1;
    }
    return Number(cur.id);
  };

  let currentMusicID = DEFAULT_CURRENT_MUSIC_ID;

  const sound = new Howl({
    src: ['https://katryomusic.s3.amazonaws.com/lets_dance.mp3'],
    loop: true,
  });

  const playCurrentMusic = () => {
    if (currentMusicID !== DEFAULT_CURRENT_MUSIC_ID) {
      sound.stop(currentMusicID);
      currentMusicID = DEFAULT_CURRENT_MUSIC_ID;
    }
    const id = sound.play();
  };

  const changeBg = async (bgName: string) => {
    let src = episode.colorMapping[bgName];
    if (!src) {
      src = episode.imageMapping[bgName];
    }
    if (!src) {
      throw new Error(`${src} is not found in colorMapping nor imageMapping.`);
    }
    setUpperBgSrc(src);
    setUpperBgIn(true);
    await sleep(TRANSITION_MS);
    setLowerBgSrc(src);
    setUpperBgIn(false);
  };

  return (
    <div id={ID_STORY_CONTAINER}>
      <div
        style={{
          width: '100%',
          height: '100%',
          left: 0,
          top: 0,
          background: lowerBGColor,
          position: 'fixed',
        }}
      ></div>
      <CSSTransition in={upperBGIn} timeout={TRANSITION_MS} classNames="upper-bg">
        <div
          style={{
            width: '100%',
            height: '100%',
            left: 0,
            top: 0,
            background: upperBGColor,
            position: 'fixed',
          }}
        ></div>
      </CSSTransition>
      <div
        style={{
          margin: '0 auto',
          maxWidth: 700,
          position: 'relative',
        }}
      >
        <h1 style={{ textAlign: 'center', color: getColor(episode.defaultTextColor) }}>{episode.episodeTitle}</h1>
        <div
          style={{
            fontSize: 17.5,
            lineHeight: 1.8,
            fontFamily:
              "'游明朝',YuMincho,'ヒラギノ明朝 Pr6N','Hiragino Mincho Pr6N','ヒラギノ明朝 ProN','Hiragino Mincho ProN','ヒラギノ明朝 StdN','Hiragino Mincho StdN',HiraMinProN-W3,'HGS明朝B','HG明朝B',dcsymbols,'Helvetica Neue',Helvetica,Arial,'ヒラギノ角ゴ Pr6N','Hiragino Kaku Gothic Pr6N','ヒラギノ角ゴ ProN','Hiragino Kaku Gothic ProN','ヒラギノ角ゴ StdN','Hiragino Kaku Gothic StdN','Segoe UI',Verdana,'メイリオ',Meiryo,sans-serif",
          }}
        >
          <PageList
            pages={episode.pages}
            currentPage={currentPage}
            isPageShowing={isPageShowing}
            textColor={textColor}
          />
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <button
          onClick={() => {
            playCurrentMusic();
          }}
        >
          play
        </button>
        {/* <button onClick={() => setPage(1)}>page</button> */}
        <button onClick={() => changeBg('pink')}>pink</button>
        <button onClick={() => changeBg('blue')}>blue</button>
        <button onClick={() => changeBg('green')}>green</button>
      </div>
    </div>
  );
};

export { StoryContainer };

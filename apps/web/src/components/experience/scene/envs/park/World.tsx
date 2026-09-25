'use client';
import { useEffect } from 'react';
import type { PublicForm } from '@formgl/shared';
import { useExperience, type Quality } from '../../../store';
import type { SceneAssets } from '../../assets';
import { Background } from '../../Background';
import { Bench } from '../../Bench';
import { Effects } from '../../Effects';
import { Envelope } from '../../Envelope';
import { Ground } from '../../Ground';
import { Lighting } from '../../Lighting';
import { Dandelions, ForegroundBranch, HeroTree } from '../../Nature';
import { Butterflies, Dust, FallingLeaves, FloatingSeeds, LightShafts } from '../../Particles';
import { PRESETS } from '../../presets';
import { parkCamConfig, sceneRefs } from '../../refs';

/** The original world: an envelope leaning on an old park bench under a tree. */
export default function ParkWorld({ form, assets, quality, onOpen }: { form: PublicForm; assets: SceneAssets; quality: Quality; onOpen: () => void }) {
  const t = form.theme;
  const preset = PRESETS[t.timeOfDay] ?? PRESETS.golden;
  const reduced = useExperience((s) => s.reducedMotion);
  useEffect(() => {
    sceneRefs.cam = parkCamConfig();
    sceneRefs.shadowRate = 0;
    sceneRefs.shadowDirty = true;
  }, []);
  return (
    <>
      <color attach="background" args={[preset.skyHorizon]} />
      <fogExp2 attach="fog" args={[preset.fog, preset.fogDensity]} />
      <Lighting preset={preset} assets={assets} quality={quality} />
      <Background preset={preset} assets={assets} quality={quality} />
      <Ground assets={assets} preset={preset} quality={quality} />
      <HeroTree assets={assets} />
      <Bench assets={assets} />
      <Envelope assets={assets} sealColor={t.sealColor} onOpen={onOpen} />
      <Dandelions assets={assets} quality={quality} />
      {quality !== 'low' && <ForegroundBranch assets={assets} />}
      {t.dust && !reduced && <Dust assets={assets} preset={preset} quality={quality} />}
      {t.fallingLeaves && !reduced && <FallingLeaves assets={assets} quality={quality} />}
      {t.petals && !reduced && <FallingLeaves assets={assets} petals count={26} quality={quality} />}
      {!reduced && <FloatingSeeds assets={assets} quality={quality} />}
      {t.butterflies && !reduced && quality !== 'low' && <Butterflies assets={assets} />}
      {t.timeOfDay !== 'overcast' && quality !== 'low' && <LightShafts preset={preset} />}
      <Effects preset={preset} quality={quality} />
    </>
  );
}

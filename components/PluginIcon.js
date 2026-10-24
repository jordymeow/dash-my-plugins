import Image from 'next/image';
import { useState } from 'react';

export default function PluginIcon({ plugin, size = 38 }) {
  const [failed, setFailed] = useState(false);
  return <span className="plugin-icon" style={{ width: size, height: size }}>
    {plugin.icon && !failed ? <Image src={plugin.icon} alt="" width={size} height={size} unoptimized onError={() => setFailed(true)} /> : <span>{plugin.name.slice(0, 2).toUpperCase()}</span>}
  </span>;
}

'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { demoClips } from '../lib/demo';
import { filterFeed, platforms, validateProfile, type Clip, type Platform } from '../lib/models';
import { uploadClip } from '../lib/upload';

export default function Home() {
  const demo = !supabase;
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(demo);
  const [clips, setClips] = useState<Clip[]>(demo ? demoClips : []);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All platforms');
  const [tab, setTab] = useState('feed');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [platform, setPlatform] = useState<Platform>('PC');
  const [hasProfile, setHasProfile] = useState(false);
  const generation = useRef(0);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let alive = true;
    // getUser revalidates with Auth rather than trusting locally cached identity.
    void client.auth.getUser().then(({ data }) => { if (alive) { setUser(data.user); setReady(true); } });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (alive) { setUser(session?.user ?? null); setReady(true); }
    });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);

  async function loadFeed(ticket: number) {
    const client = supabase;
    if (!client) return;
    const { data, error: issue } = await client.from('clips')
      .select('id,user_id,title,game,storage_path,created_at,profiles(username,platform)')
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(40);
    if (issue) throw new Error('Could not load the feed. Check your connection and database setup.');
    const rows = (data ?? []) as unknown as Clip[];
    const resolved = await Promise.all(rows.map(async clip => {
      const { data: signed } = await client.storage.from('gameplay-clips').createSignedUrl(clip.storage_path, 3600);
      return { ...clip, url: signed?.signedUrl };
    }));
    if (generation.current === ticket) setClips(resolved);
  }

  useEffect(() => {
    const ticket = ++generation.current;
    if (!supabase || !user) { if (!demo) setClips([]); setHasProfile(false); setLoading(false); return; }
    const client = supabase;
    setHasProfile(false); setLoading(true); setError('');
    void (async () => {
      try {
        const { data, error: issue } = await client.from('profiles').select('username,bio,platform').eq('id', user.id).maybeSingle();
        if (issue) throw new Error('Could not load your profile. Check database setup.');
        if (generation.current !== ticket) return;
        setUsername(data?.username ?? ''); setBio(data?.bio ?? ''); setPlatform(data?.platform ?? 'PC'); setHasProfile(Boolean(data));
        await loadFeed(ticket);
      } catch (issue) { if (generation.current === ticket) setError(issue instanceof Error ? issue.message : 'Could not load data.'); }
      finally { if (generation.current === ticket) setLoading(false); }
    })();
    return () => { generation.current++; };
  }, [user, demo]);

  async function act(work: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('');
    try { await work(); }
    catch (issue) { setError(issue instanceof Error ? issue.message : 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  }
  async function auth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const email = String(form.get('email')), password = String(form.get('password'));
    const signup = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'signup';
    await act(async () => {
      if (!supabase) return;
      const response = signup ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
      if (response.error) throw new Error(signup ? 'Sign-up failed. Check your email and password, then try again.' : 'Sign-in failed. Check your credentials or confirm your email.');
      setMessage(signup && !response.data.session ? 'Check your inbox to confirm your account, then sign in.' : 'You are signed in.');
    });
  }
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await act(async () => {
      if (!supabase || !user) return;
      const value = validateProfile({ username, bio, platform });
      const { error: issue } = await supabase.from('profiles').upsert({ id: user.id, ...value }, { onConflict: 'id' });
      if (issue) throw new Error(issue.code === '23505' ? 'That username is taken. Choose another.' : 'Profile could not be saved. Check your connection.');
      setUsername(value.username); setHasProfile(true); setMessage('Profile saved. You can now share clips.');
      await loadFeed(generation.current);
    });
  }
  async function shareClip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const element = event.currentTarget, form = new FormData(element);
    await act(async () => {
      const client = supabase;
      if (!client || !user) return;
      if (!hasProfile) throw new Error('Save your profile before uploading a clip.');
      const file = form.get('video');
      if (!(file instanceof File)) throw new Error('Choose a video first.');
      await uploadClip({
        async put(path, value) { const { error: issue } = await client.storage.from('gameplay-clips').upload(path, value, { contentType: value.type, upsert: false }); if (issue) throw new Error('Upload failed. Check the file, connection, and storage policies.'); },
        async insert(row) { const { error: issue } = await client.from('clips').insert(row); if (issue) throw issue; },
        async remove(path) { const { error: issue } = await client.storage.from('gameplay-clips').remove([path]); if (issue) throw issue; },
      }, user.id, { title: String(form.get('title')), game: String(form.get('game')) }, file);
      element.reset(); setMessage('Your clip is now in the community feed.'); setTab('feed');
      await loadFeed(generation.current);
    });
  }

  const visible = filterFeed(clips, query, filter);
  return <>
    <header className="topbar"><a className="brand" href="/">C<span>↗</span> CROSSPLAY HUB</a><span className="status">{demo ? 'DEMO WORKSPACE' : user ? 'CONNECTED' : 'WELCOME'}</span></header>
    <div className="shell">
      <aside><p className="eyebrow">YOUR CORNER OF THE GAME</p><nav aria-label="Workspace">
        {['feed', 'profile', 'upload'].map(item => <button key={item} className={tab === item ? 'nav active' : 'nav'} onClick={() => { setTab(item); setError(''); setMessage(''); }}>{item === 'feed' ? '◈ Community feed' : item === 'profile' ? '◎ Your profile' : '↥ Share a clip'}</button>)}
      </nav><div className="side-note"><span className="dot" /> Across platforms.<br/>Around the same passion.</div>
        {user && <button className="secondary" disabled={busy} onClick={() => void act(async () => { const { error: issue } = await supabase!.auth.signOut(); if (issue) throw new Error('Sign-out failed. Please try again.'); setUsername(''); setBio(''); })}>Sign out</button>}
      </aside>
      <main>
        <section className="hero"><p className="eyebrow">PLAY IT. CLIP IT. SHARE IT.</p><h1>Your game.<br/><span>Your community.</span></h1><p>A place for the plays worth sharing and the people behind them.</p><button onClick={() => setTab('upload')}>Share your moment <span>↗</span></button><div className="hero-art" aria-hidden="true"><div className="orbit"/><span>PLAY<br/>TOGETHER</span></div></section>
        {demo && <p className="notice">Read-only demo with fictional sample profiles and clip cards. Configure Supabase to sign in, save a profile, and upload playable videos.</p>}
        {error && <p role="alert" className="error">{error}</p>}{message && <p role="status" className="notice">{message}</p>}
        {!ready && <p role="status">Checking your session…</p>}
        {!demo && ready && !user && <section className="panel auth"><h2>Join the community</h2><p>Sign in to view clips and create your profile.</p><form onSubmit={auth}>
          <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>
          <label>Password<input name="password" type="password" autoComplete="current-password" minLength={8} maxLength={128} required/></label>
          <div className="actions"><button disabled={busy} type="submit" value="signin">Sign in</button><button disabled={busy} className="secondary" type="submit" value="signup">Create account</button></div>
        </form></section>}
        {tab === 'feed' && (demo || user) && <section><div className="section-head"><div><p className="eyebrow">THE LATEST PLAYS</p><h2>Community feed</h2></div>{user && <button className="secondary" disabled={busy || loading} onClick={() => void act(() => loadFeed(generation.current))}>Refresh feed</button>}</div>
          <div className="filters"><label className="search">Search clips<input aria-label="Search clips" placeholder="Game, title, or gamer…" value={query} onChange={e => setQuery(e.target.value)}/></label><label>Platform<select value={filter} onChange={e => setFilter(e.target.value)}>{['All platforms', ...platforms].map(p => <option key={p}>{p}</option>)}</select></label></div>
          {loading ? <p role="status">Loading community clips…</p> : <div className="feed">{visible.map((clip, i) => <article className="clip" key={clip.id}>
            {clip.url ? <video controls playsInline preload="metadata" src={clip.url} aria-label={clip.title}/> : <div className={`video-placeholder tone-${i % 2}`}><span>{demo ? 'SAMPLE CLIP CARD' : 'VIDEO UNAVAILABLE'}</span><strong>{demo ? clip.game : 'Refresh to retry'}</strong></div>}
            <div className="clip-body"><span className="tag">{clip.game}</span><h3>{clip.title}</h3><p>@{clip.profiles?.username ?? 'gamer'} <span>· {clip.profiles?.platform ?? 'Unknown platform'}</span></p></div>
          </article>)}</div>}
          {!loading && !visible.length && <div className="empty"><h3>{clips.length ? 'No matching clips' : 'The next great play could be yours.'}</h3><p>{clips.length ? 'Try another game or platform.' : 'Create your profile and share the first clip.'}</p></div>}
          <p className="muted">Showing up to 40 recent clips. Playback links expire after one hour; refresh to renew them.</p>
        </section>}
        {tab === 'profile' && (demo || user) && <section className="panel"><h2>Your player profile</h2>{demo ? <p>Profile editing is available after Supabase is configured and you sign in.</p> : <form onSubmit={saveProfile}>
          <label>Username<input value={username} onChange={e => setUsername(e.target.value)} minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]{3,24}" required autoComplete="username"/></label>
          <label>Platform<select value={platform} onChange={e => setPlatform(e.target.value as Platform)}>{platforms.map(p => <option key={p}>{p}</option>)}</select></label>
          <label>Bio<textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={240} placeholder="What do you play?"/></label><button disabled={busy || loading}>{busy ? 'Saving…' : 'Save profile'}</button>
        </form>}</section>}
        {tab === 'upload' && (demo || user) && <section className="panel"><h2>Share a gameplay clip</h2>{demo ? <p>Uploads are available after Supabase is configured. This demo does not store files.</p> : <form onSubmit={shareClip}>
          {!hasProfile && <p className="notice">Create and save your profile first.</p>}<label>Clip title<input name="title" required maxLength={100}/></label><label>Game<input name="game" required maxLength={60}/></label>
          <label className="drop">Choose your video<input name="video" type="file" accept="video/mp4,video/webm,video/quicktime" required/><span>MP4, WebM, or MOV · up to 50 MiB</span></label>
          <label className="check"><input type="checkbox" required/>I own or have permission to share this clip with signed-in community members.</label><button disabled={busy || !hasProfile || loading}>{busy ? 'Uploading…' : 'Publish clip'}</button>
        </form>}</section>}
      </main>
    </div><footer>CrossPlay Hub · Built for community, across platforms.</footer>
  </>;
}

#!/usr/bin/env python3
"""Bounded metadata collection for the static Engineering Journal. Python standard library only."""
import argparse
import concurrent.futures
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from hashlib import sha256
from html import unescape
from html.parser import HTMLParser
import json
import gzip
import io
from pathlib import Path
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
REGISTRY = Path(__file__).with_name('sources.json')
USER_AGENT = 'EngineeringJournal/1.0 (+https://stavreskimario.github.io/engineering-journal/)'
MAX_BYTES = 4_000_000
MAX_ARTICLES = 2000
TOPICS = {
 'ai': r'\b(ai|llm|agent[s]?|gpt|claude|grok|inference|generative|language model|transformer|evals?)\b',
 'architecture': r'\b(architect\w*|distributed|infrastructure|scal\w*|microservice\w*|database\w*|network\w*|storage|platform)\b',
 'data': r'\b(data|ml|machine learning|training|feature[s]?|pipeline\w*|spark|analytics|retrieval)\b',
 'reliability': r'\b(reliab\w*|performance|latency|incident|outage|retry|debug\w*|efficien\w*|optim\w*|quality|testing)\b',
 'security': r'\b(secur\w*|sandbox\w*|privacy|authentication|attack\w*|encryption|contain\w*)\b',
 'devtools': r'\b(developer\w*|coding|code|git|compiler|sdlc|copilot|sdk|ide|engineering|software factory)\b'
}
CORPORATE = re.compile(r'\b(raises? \$|series [a-f]|funding|fundrais\w*|acqui(?:re|red|sition)|joins spacex|partnership|summit|conference|webinar|hiring|careers|anniversary|annual report|our mission|worth building is human)\b', re.I)


def iso(dt): return dt.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')

def parse_date(value):
    if not isinstance(value, str) or not value.strip(): return None
    value = value.strip()
    try:
        dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        try: dt = parsedate_to_datetime(value)
        except (ValueError, TypeError, OverflowError):
            dt = None
            for fmt in ('%B %d, %Y', '%b %d, %Y', '%B %d %Y', '%b %d %Y', '%d %B %Y', '%d %b %Y'):
                try: dt = datetime.strptime(value, fmt); break
                except ValueError: pass
            if dt is None: return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


class TextOnly(HTMLParser):
    def __init__(self): super().__init__(convert_charrefs=True); self.parts=[]; self.skip=0
    def handle_starttag(self, tag, attrs):
        if tag in ('script','style'): self.skip += 1
    def handle_endtag(self, tag):
        if tag in ('script','style') and self.skip: self.skip -= 1
        if tag in ('p','div','br','li'): self.parts.append(' ')
    def handle_data(self, data):
        if not self.skip: self.parts.append(data)


def plain(value, limit=400):
    parser=TextOnly(); parser.feed(str(value or ''))
    return re.sub(r'\s+', ' ', unescape(' '.join(parser.parts))).strip()[:limit]


def safe_url(raw, source, base=None, article=True):
    if not isinstance(raw,str): return None
    try:
        u=urllib.parse.urlsplit(urllib.parse.urljoin(base or source['homepage'],raw))
        if u.scheme!='https' or u.hostname not in source['hosts'] or u.username or u.password or u.port not in (None,443): return None
        if article and not re.search(source['pathPattern'],u.path): return None
        query=urllib.parse.urlencode([(k,v) for k,v in urllib.parse.parse_qsl(u.query,keep_blank_values=True) if not k.lower().startswith('utm_') and k.lower() not in ('fbclid','gclid','mc_cid','mc_eid','source','ref')])
        return urllib.parse.urlunsplit(('https',u.netloc.lower(),u.path.rstrip('/')+'/' if u.path.endswith('/') else u.path,query,''))
    except (ValueError,TypeError): return None


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def __init__(self,source): self.source=source
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        if not safe_url(newurl,self.source,req.full_url,article=False): raise ValueError('Redirect outside approved source hosts')
        return super().redirect_request(req,fp,code,msg,headers,newurl)


def fetch(url, source, conditional=None):
    if not safe_url(url,source,article=False): raise ValueError('Unapproved collection URL')
    headers={'User-Agent':USER_AGENT,'Accept':'application/atom+xml, application/rss+xml, application/xml, text/html;q=0.9, */*;q=0.5','Accept-Encoding':'identity'}
    if conditional:
        for field,header in [('etag','If-None-Match'),('modified','If-Modified-Since')]:
            if conditional.get(field): headers[header]=conditional[field]
    opener=urllib.request.build_opener(SafeRedirect(source))
    try:
        with opener.open(urllib.request.Request(url,headers=headers),timeout=20) as response:
            payload=response.read(MAX_BYTES+1)
            if len(payload)>MAX_BYTES: raise ValueError('Source exceeds size limit')
            # Some publishers gzip even when identity is requested. Bound both sizes.
            if payload.startswith(b'\x1f\x8b'):
                with gzip.GzipFile(fileobj=io.BytesIO(payload)) as stream:
                    payload=stream.read(MAX_BYTES+1)
                if len(payload)>MAX_BYTES: raise ValueError('Expanded source exceeds size limit')
            return payload.decode('utf-8',errors='replace'), {'etag':response.headers.get('ETag'), 'modified':response.headers.get('Last-Modified')}, response.geturl()
    except urllib.error.HTTPError as exc:
        if exc.code==304: return None, conditional or {}, url
        raise


def local_name(tag): return tag.rsplit('}',1)[-1]

def child_text(el,names):
    for child in el:
        if local_name(child.tag) in names and child.text: return child.text
    return ''


def parse_feed(text,source):
    declarations=re.sub(r'<!\[CDATA\[.*?\]\]>|<!--.*?-->', '', text, flags=re.S)
    if re.search(r'<!\s*(?:DOCTYPE|ENTITY)',declarations,re.I): raise ValueError('DTD/entity declarations are not accepted')
    root=ET.fromstring(text)
    if local_name(root.tag) not in ('rss','feed','RDF'): raise ValueError('Response is not a feed')
    records=[]
    for item in root.iter():
        if local_name(item.tag) not in ('item','entry'): continue
        link=child_text(item,('link',))
        if not link:
            for node in item:
                if local_name(node.tag)=='link' and node.get('rel','alternate')=='alternate': link=node.get('href',''); break
        records.append({'title':child_text(item,('title',)),'url':link,'publishedAt':child_text(item,('pubDate','published','date')),'updatedAt':child_text(item,('updated',)),'excerpt':child_text(item,('description','summary')),'categories':[c.text or c.get('term','') for c in item if local_name(c.tag)=='category']})
    if not records: raise ValueError('No feed entries found; source may have changed')
    return records


class Node:
    def __init__(self,tag='',attrs=(),parent=None): self.tag=tag;self.attrs=dict(attrs);self.parent=parent;self.children=[]
    def walk(self):
        yield self
        for child in self.children:
            if isinstance(child,Node): yield from child.walk()
    def text(self):
        if self.tag in ('script','style','noscript','svg'): return ''
        return ' '.join(c.text() if isinstance(c,Node) else c for c in self.children)


class Document(HTMLParser):
    VOID={'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
    def __init__(self): super().__init__(convert_charrefs=True); self.root=Node();self.current=self.root
    def handle_starttag(self,tag,attrs):
        node=Node(tag,attrs,self.current);self.current.children.append(node)
        if tag not in self.VOID: self.current=node
    def handle_startendtag(self,tag,attrs): self.current.children.append(Node(tag,attrs,self.current))
    def handle_endtag(self,tag):
        node=self.current
        while node.parent:
            if node.tag==tag: self.current=node.parent;return
            node=node.parent
    def handle_data(self,data): self.current.children.append(data)


DATE_TEXT=re.compile(r'\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+20\d{2}\b',re.I)


def parse_index(text,source):
    doc=Document();doc.feed(text);records=[]
    # Prefer linked headings and a single article card's date, never the page-wide date.
    for a in doc.root.walk():
        if a.tag!='a': continue
        url=safe_url(a.attrs.get('href'),source)
        if not url or url.rstrip('/')==source['homepage'].rstrip('/'): continue
        if any(n.tag in ('nav','footer','header') or 'navbar' in n.attrs.get('class','') for n in ancestors(a)): continue
        def title_node(n):
            return n.tag in ('h2','h3','h4') or bool(source.get('titleClass') and re.search(source['titleClass'],n.attrs.get('class','')))
        headings=[n for n in a.walk() if title_node(n)]
        container=a
        for parent in ancestors(a):
            article_links={safe_url(n.attrs.get('href'),source) for n in parent.walk() if n.tag=='a'}-{None}
            if len(article_links)>1: break
            container=parent
            if parent.tag in ('article','li'): break
        if not headings: headings=[n for n in container.walk() if title_node(n)]
        if source.get('titleClass') and not headings: continue
        title=plain(headings[0].text() if headings else a.text(),500)
        date=None
        for n in container.walk():
            if n.tag=='time': date=n.attrs.get('datetime') or plain(n.text());break
        match=DATE_TEXT.search(container.text())
        if not date and match: date=match.group()
        if source.get('requireDate') and not parse_date(date): continue
        if not headings:
            title=DATE_TEXT.sub('',title).strip(' ·|–—')
            title=re.sub(r'^(Featured|Research|Engineering|Company|Product)\s+', '',title,flags=re.I)
        if len(title)<10 or len(title.split())<2 or re.fullmatch(r'(read (?:more|article)|learn more|view all posts)[\s→↗]*',title,re.I): continue
        records.append({'url':url,'title':title,'publishedAt':date,'excerpt':'','categories':[]})
    # Some publishers expose authoritative article dates/headlines through JSON-LD.
    def structured(obj):
        if isinstance(obj,list):
            for value in obj: structured(value)
        elif isinstance(obj,dict):
            if obj.get('@type') in ('BlogPosting','Article','NewsArticle'):
                entity=obj.get('mainEntityOfPage',{})
                url=obj.get('url') or (entity.get('@id') if isinstance(entity,dict) else entity)
                records.append({'url':url,'title':obj.get('headline') or obj.get('name'),'publishedAt':obj.get('datePublished'),'updatedAt':obj.get('dateModified'),'excerpt':obj.get('description',''),'categories':[]})
            for value in obj.values():
                if isinstance(value,(list,dict)): structured(value)
    for n in doc.root.walk():
        if n.tag=='script' and n.attrs.get('type')=='application/ld+json':
            try: structured(json.loads(''.join(c for c in n.children if isinstance(c,str))))
            except (ValueError,TypeError): pass
    if not records: raise ValueError('No article links found; source may require an adapter update')
    return records


def ancestors(node):
    while node.parent:
        node=node.parent
        yield node


def normalise(raw,source,now):
    url=safe_url(raw.get('url'),source);title=plain(raw.get('title'),300)
    if not url or not title: return None
    if CORPORATE.search(title): return None
    excerpt=plain(raw.get('excerpt'),240)
    words=' '.join([title,excerpt,*raw.get('categories',[])])
    matches=[k for k,pattern in TOPICS.items() if re.search(pattern,words,re.I)]
    if source.get('technicalOnly') and not matches: return None
    topics=list(dict.fromkeys(matches+source.get('defaultTopics',[])))[:4]
    published=parse_date(raw.get('publishedAt'))
    if published and published>now+timedelta(days=1): return None
    updated=parse_date(raw.get('updatedAt'))
    kind=source.get('defaultType','case-study')
    if re.search(r'\b(how to|tutorial|guide|best practices)\b',title,re.I): kind='tutorial'
    elif re.search(r'\b(introducing|announcing|now available|launching)\b',title,re.I): kind='announcement'
    return {'id':sha256(url.rstrip('/').encode()).hexdigest()[:24],'sourceId':source['id'],'title':title,'url':url,'publishedAt':iso(published) if published else None,'updatedAt':iso(updated) if updated else None,'firstSeenAt':iso(now),'excerpt':excerpt,'topics':topics,'type':kind}


def validate_catalogue(data,sources):
    if not isinstance(data,dict) or data.get('version')!=1 or not isinstance(data.get('articles'),list) or len(data['articles'])>MAX_ARTICLES or not isinstance(data.get('sources'),list): raise ValueError('Invalid catalogue schema')
    by_id={s['id']:s for s in sources};seen=set()
    for a in data['articles']:
        if not isinstance(a,dict) or a.get('sourceId') not in by_id or not safe_url(a.get('url'),by_id[a['sourceId']]) or not isinstance(a.get('title'),str) or not a['title'] or len(a['title'])>500 or not re.fullmatch(r'[a-z0-9_-]{1,100}',str(a.get('id',''))) or a['id'] in seen: raise ValueError('Invalid or duplicate catalogue article')
        for field in ('publishedAt','updatedAt','firstSeenAt'):
            if a.get(field) and not parse_date(a[field]): raise ValueError('Invalid article date')
        if not isinstance(a.get('topics'),list) or any(t not in TOPICS for t in a['topics']): raise ValueError('Invalid topics')
        if a.get('type') not in ('case-study','research','tutorial','announcement'): raise ValueError('Invalid article type')
        seen.add(a['id'])
    if any(not isinstance(s,dict) or s.get('id') not in by_id or s.get('status') not in ('pending','ok','error') or (s.get('http') is not None and not isinstance(s['http'],dict)) for s in data['sources']): raise ValueError('Invalid source status')
    for source in data['sources']:
        for field in ('lastAttemptAt','lastSuccessAt'):
            if source.get(field) and not parse_date(source[field]): raise ValueError('Invalid source timestamp')
    for field in ('lastPollAt','generatedAt'):
        if data.get(field) and not parse_date(data[field]): raise ValueError('Invalid catalogue timestamp')
    return data


def collect_source(source,old_status,now):
    failures=[]
    for endpoint in source['endpoints']:
        try:
            previous=old_status.get('http',{}) if old_status.get('endpoint')==endpoint['url'] else {}
            text,http,final=fetch(endpoint['url'],source,previous)
            records=None if text is None else (parse_feed(text,source) if endpoint['kind']=='rss' else parse_index(text,source))
            articles=None if records is None else [a for raw in records[:300] if (a:=normalise(raw,source,now))]
            return articles,{'status':'ok','lastAttemptAt':iso(now),'lastSuccessAt':iso(now),'endpoint':endpoint['url'],'method':endpoint['kind'],'http':http,'error':None}
        except (OSError,ValueError,ET.ParseError,EOFError) as exc:
            failures.append(type(exc).__name__+': '+str(exc)[:160])
    return [],{**old_status,'status':'error','lastAttemptAt':iso(now),'error':'; '.join(failures)[:400]}


def merge_catalogue(previous,sources,results,now):
    old={s['id']:s for s in previous.get('sources',[])}
    allowed={s['id'] for s in sources}
    by_url={a['url'].rstrip('/'):dict(a) for a in previous['articles'] if a['sourceId'] in allowed}
    for source in sources:
        records,status=results[source['id']]
        for a in records or []:
            key=a['url'].rstrip('/');prior=by_url.get(key)
            if prior:
                a={**a,'id':prior['id'],'firstSeenAt':prior.get('firstSeenAt',a['firstSeenAt']),'publishedAt':prior.get('publishedAt') or a['publishedAt']}
            by_url[key]=a
    cutoff=now-timedelta(days=180)
    articles=[a for a in by_url.values() if (parse_date(a.get('publishedAt')) or parse_date(a.get('firstSeenAt')) or now)>=cutoff]
    articles.sort(key=lambda a:(a.get('publishedAt') or '',a.get('firstSeenAt') or '',a['id']),reverse=True)
    public_sources=[]
    for s in sources:
        _,status=results[s['id']]
        public_sources.append({k:s[k] for k in ('id','name','mark','homepage','hosts','description','method')}|{'lastSuccessAt':old.get(s['id'],{}).get('lastSuccessAt')}|status)
    return {'version':1,'seed':False,'generatedAt':iso(now),'lastPollAt':iso(now),'sources':public_sources,'articles':articles[:MAX_ARTICLES]}


def recover(url,sources):
    u=urllib.parse.urlsplit(url)
    if u.scheme!='https' or u.netloc!='stavreskimario.github.io' or not u.path.endswith('/engineering-journal/data/catalogue.json'): raise ValueError('Unexpected previous-catalogue location')
    fake={'homepage':url,'hosts':['stavreskimario.github.io']}
    text,_,_=fetch(url,fake)
    return validate_catalogue(json.loads(text),sources)


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=ROOT/'engineering-journal/data/catalogue.json');parser.add_argument('--previous-url');parser.add_argument('--reuse-only',action='store_true');parser.add_argument('--validate-only',action='store_true');parser.add_argument('--sources',type=Path,default=REGISTRY);args=parser.parse_args()
    sources=json.loads(args.sources.read_text())['sources']
    previous=validate_catalogue(json.loads(args.output.read_text()),sources)
    if args.validate_only: print(f'Validated {len(previous["articles"])} articles.');return
    if args.previous_url:
        try: previous=recover(args.previous_url,sources)
        except urllib.error.HTTPError as exc:
            if exc.code!=404: raise
            print('No previous deployment (404); using the checked-in starter collection.',file=sys.stderr)
        # Other network/schema errors fail closed: never replace a live archive with a seed.
    if args.reuse_only: data=previous
    else:
        now=datetime.now(timezone.utc);old={s['id']:s for s in previous['sources']};results={}
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            futures={pool.submit(collect_source,s,old.get(s['id'],{}),now):s for s in sources}
            for future in concurrent.futures.as_completed(futures):
                s=futures[future];results[s['id']]=future.result();records,status=results[s['id']]
                print(f'{s["name"]}: {status["status"]} ({"unchanged" if records is None else len(records)} entries)',flush=True)
        if not any(status['status']=='ok' for _,status in results.values()): raise SystemExit('All publishers failed; catalogue left unchanged.')
        data=merge_catalogue(previous,sources,results,now)
    validate_catalogue(data,sources)
    args.output.parent.mkdir(parents=True,exist_ok=True);temp=args.output.with_suffix('.tmp');temp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');temp.replace(args.output)
    print(f'Wrote {len(data["articles"])} articles to {args.output}')

if __name__=='__main__': main()

//! Loading benchmarks for the container layer: archive open, the dimension scan, a single
//! page, a thumbnail, a preload burst, and the latency a page read sees while a scan runs.
//!
//! Permanent, but never part of a plain `cargo test`: every test here is `#[ignore]`d, so
//! neither `npm run test:backend` nor CI builds the 170 MiB fixture set. Run one by name,
//! in release — a debug build measures the decoder rather than the design:
//! `cargo test --release --lib perfbench_report -- --ignored --nocapture --test-threads=1`

use std::{
    fs::{self, File},
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use image::codecs::jpeg::JpegEncoder;
use rayon::iter::{IntoParallelRefIterator, ParallelIterator};
use zip::{write::FileOptions, ZipArchive, ZipWriter};

use crate::{
    container::{
        directory_container::DirectoryContainer, epub_container::EpubContainer,
        pdf_container::PdfContainer, rar_container::RarContainer, traits::Container,
        zip_container::ZipContainer,
    },
    image::{
        resizer::ResizeFilter,
        types::{read_dimensions, Image},
    },
    page::{
        cache::Cache,
        pipeline::Pipeline,
        service::{PageService, Priority},
    },
};

const PAGE_W: u32 = 1400;
const PAGE_H: u32 = 2000;
const PAGE_COUNT: usize = 200;
/// How many pages the "preload burst" benchmarks touch.
const BURST: usize = 20;
/// Bytes of a decompressed entry the proposed header-only scan reads.
const HEADER_PROBE: u64 = 64 * 1024;

// ---------------------------------------------------------------- timing utils

fn median(mut v: Vec<Duration>) -> Duration {
    v.sort();
    v[v.len() / 2]
}

fn ms(d: Duration) -> f64 {
    d.as_secs_f64() * 1000.0
}

/// Times `f` `iters` times and reports the median.
fn bench<T>(label: &str, iters: u32, mut f: impl FnMut() -> T) -> Duration {
    let mut samples = Vec::new();
    for _ in 0..iters {
        let t = Instant::now();
        let out = f();
        samples.push(t.elapsed());
        std::hint::black_box(out);
    }
    let m = median(samples);
    println!("  {label:<52} {:>9.2} ms", ms(m));
    m
}

// ------------------------------------------------------------ fixture builders

/// Builds one JPEG page that compresses like a real scanned page.
fn make_page(seed: usize) -> Vec<u8> {
    let mut buf = image::RgbImage::new(PAGE_W, PAGE_H);
    let mut state = (seed as u32).wrapping_mul(2_654_435_761).wrapping_add(1);
    for (x, y, px) in buf.enumerate_pixels_mut() {
        if (x / 48 + y / 48 + seed as u32).is_multiple_of(5) {
            state = state.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
            let v = (state >> 24) as u8;
            *px = image::Rgb([v, v.wrapping_add(40), v.wrapping_add(90)]);
        } else {
            let v = ((x * 255 / PAGE_W) as u8).wrapping_add((y * 96 / PAGE_H) as u8);
            *px = image::Rgb([v, v / 2 + 60, 255 - v]);
        }
    }
    let mut out = Vec::new();
    let mut enc = JpegEncoder::new_with_quality(&mut out, 80);
    enc.encode_image(&image::DynamicImage::ImageRgb8(buf))
        .expect("encode page");
    out
}

fn page_name(i: usize) -> String {
    format!("{i:0>4}.jpg")
}

fn build_zip(dir: &Path, pages: &[Vec<u8>]) -> PathBuf {
    let path = dir.join("bench.zip");
    let mut zip = ZipWriter::new(File::create(&path).expect("create zip"));
    let opts = FileOptions::<()>::default().compression_method(zip::CompressionMethod::Deflated);
    for (i, page) in pages.iter().enumerate() {
        zip.start_file(page_name(i), opts).expect("start entry");
        zip.write_all(page).expect("write entry");
    }
    zip.finish().expect("finish zip");
    path
}

fn build_dir(dir: &Path, pages: &[Vec<u8>]) -> PathBuf {
    let path = dir.join("bench_dir");
    fs::create_dir_all(&path).expect("create dir");
    for (i, page) in pages.iter().enumerate() {
        fs::write(path.join(page_name(i)), page).expect("write page");
    }
    path
}

fn build_epub(dir: &Path, pages: &[Vec<u8>]) -> PathBuf {
    let path = dir.join("bench.epub");
    let mut zip = ZipWriter::new(File::create(&path).expect("create epub"));
    let opts = FileOptions::<()>::default().compression_method(zip::CompressionMethod::Stored);

    zip.start_file("mimetype", opts).expect("mimetype");
    zip.write_all(b"application/epub+zip").expect("mimetype");

    zip.start_file("META-INF/container.xml", opts).expect("cx");
    let container_xml = concat!(
        r#"<?xml version="1.0"?><container version="1.0" "#,
        r#"xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles>"#,
        r#"<rootfile full-path="OEBPS/content.opf" "#,
        r#"media-type="application/oebps-package+xml"/></rootfiles></container>"#
    );
    zip.write_all(container_xml.as_bytes()).expect("cx");

    let mut manifest = String::new();
    let mut spine = String::new();
    for i in 0..pages.len() {
        manifest.push_str(&format!(
            r#"<item id="img{i}" href="images/{i:0>4}.jpg" media-type="image/jpeg"/>"#
        ));
        manifest.push_str(&format!(
            r#"<item id="ch{i}" href="text/ch{i}.xhtml" media-type="application/xhtml+xml"/>"#
        ));
        spine.push_str(&format!(r#"<itemref idref="ch{i}"/>"#));
    }
    let opf = format!(
        concat!(
            r#"<?xml version="1.0" encoding="UTF-8"?>"#,
            r#"<package xmlns="http://www.idpf.org/2007/opf" version="3.0" "#,
            r#"unique-identifier="bookid">"#,
            r#"<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">"#,
            r#"<dc:title>Bench</dc:title>"#,
            r#"<dc:identifier id="bookid">urn:uuid:bench</dc:identifier>"#,
            r#"<dc:language>ja</dc:language>"#,
            r#"<meta property="rendition:layout">pre-paginated</meta>"#,
            r#"</metadata><manifest>{}</manifest><spine>{}</spine></package>"#
        ),
        manifest, spine
    );
    zip.start_file("OEBPS/content.opf", opts).expect("opf");
    zip.write_all(opf.as_bytes()).expect("opf");

    for i in 0..pages.len() {
        let xhtml = format!(
            concat!(
                r#"<?xml version="1.0" encoding="UTF-8"?>"#,
                r#"<html xmlns="http://www.w3.org/1999/xhtml"><head><title>p{}</title></head>"#,
                r#"<body><div class="p"><img src="../images/{:0>4}.jpg" alt=""/></div></body></html>"#
            ),
            i, i
        );
        zip.start_file(format!("OEBPS/text/ch{i}.xhtml"), opts)
            .expect("chapter");
        zip.write_all(xhtml.as_bytes()).expect("chapter");
    }
    for (i, page) in pages.iter().enumerate() {
        zip.start_file(format!("OEBPS/images/{i:0>4}.jpg"), opts)
            .expect("image");
        zip.write_all(page).expect("image");
    }
    zip.finish().expect("finish epub");
    path
}

fn pdfium_lib_path() -> String {
    let base = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("target")
        .join("dependencies")
        .join("pdfium");
    let lib = if base.join("bin").exists() {
        base.join("bin")
    } else {
        base.join("lib")
    };
    lib.to_string_lossy().to_string()
}

fn build_pdf(dir: &Path, pages: &[Vec<u8>]) -> PathBuf {
    use pdfium_render::prelude::{
        PdfPageImageObject, PdfPageObjectsCommon, PdfPagePaperSize, Pdfium,
    };

    let path = dir.join("bench.pdf");
    let lib = pdfium_lib_path();
    let bindings = Pdfium::bind_to_library(Pdfium::pdfium_platform_library_name_at_path(&lib))
        .expect("bind pdfium");
    let pdfium = Pdfium::new(bindings);
    let mut doc = pdfium.create_new_pdf().expect("create pdf");
    let size = PdfPagePaperSize::a4();
    let (w, h) = (size.width(), size.height());
    for (i, page_bytes) in pages.iter().enumerate() {
        let mut obj =
            PdfPageImageObject::new_from_jpeg_reader(&doc, std::io::Cursor::new(page_bytes.clone()))
                .expect("embed jpeg");
        obj.scale(w.value, h.value).expect("scale");
        let mut page = doc
            .pages_mut()
            .create_page_at_index(PdfPagePaperSize::a4(), i as u16)
            .expect("create page");
        page.objects_mut().add_image_object(obj).expect("add image");
    }
    doc.save_to_file(&path).expect("save pdf");
    path
}

// -------------------------------------------------------- reading, as the app does

/// The pipeline the shipped defaults produce: no height cap, so a page reaches the
/// viewer as its archive stored it.
const PIPELINE: Pipeline = Pipeline {
    max_image_height: 0,
    resize_method: ResizeFilter::Bilinear,
};

/// One page, read and prepared exactly as a `PageService` worker prepares it.
fn page(container: &Arc<dyn Container>, entry: &str) -> Arc<Image> {
    let bytes = container
        .open_reader()
        .expect("open reader")
        .read_page(entry)
        .expect("read page");
    PIPELINE.page(bytes).expect("decode page")
}

/// Every page's dimensions through one reader — the shape `PageService::dimensions` uses.
fn scan(container: &Arc<dyn Container>, entries: &[String]) -> Vec<crate::image::types::ImageDimensions> {
    let mut reader = container.open_reader().expect("open reader");
    entries
        .iter()
        .map(|entry| reader.page_dimensions(entry).expect("measure page"))
        .collect()
}

/// A page's thumbnail, the way a bookshelf entry gets one: the format's own preview when
/// it has a cheaper path to one, and a full read shrunk here when it does not.
fn thumbnail(container: &Arc<dyn Container>, entry: &str) -> Vec<u8> {
    let mut reader = container.open_reader().expect("open reader");
    match reader.read_preview(entry).expect("preview") {
        Some(bytes) => bytes,
        None => Pipeline::thumbnail(&reader.read_page(entry).expect("read page"))
            .expect("shrink page")
            .data
            .clone(),
    }
}

// ------------------------------------------------------------- zip A/B helpers

/// A whole-book scan by full decompression of every entry, through one shared archive
/// handle: the shape the container layer used to impose, kept as the floor the two
/// variants below are measured against.
fn zip_scan_full(path: &Path) -> usize {
    let mut ar = ZipArchive::new(File::open(path).unwrap()).unwrap();
    let mut n = 0;
    for i in 0..ar.len() {
        let mut f = ar.by_index(i).unwrap();
        let mut buf = Vec::with_capacity(f.size() as usize);
        f.read_to_end(&mut buf).unwrap();
        n += read_dimensions(&buf).unwrap().width as usize;
    }
    n
}

/// The same scan, stopping each decompression stream once the header is in hand.
fn zip_scan_header_only(path: &Path) -> usize {
    let mut ar = ZipArchive::new(File::open(path).unwrap()).unwrap();
    let mut n = 0;
    for i in 0..ar.len() {
        let f = ar.by_index(i).unwrap();
        let want = f.size().min(HEADER_PROBE);
        let mut buf = Vec::with_capacity(want as usize);
        f.take(want).read_to_end(&mut buf).unwrap();
        n += read_dimensions(&buf).unwrap().width as usize;
    }
    n
}

/// The same scan again, with per-thread archive handles over one shared central
/// directory — what `ZipReader` does, and what the app now pays.
fn zip_scan_parallel_header_only(path: &Path, pool: &rayon::ThreadPool) -> usize {
    let base = ZipArchive::new(File::open(path).unwrap()).unwrap();
    let meta = base.metadata();
    let idx: Vec<usize> = (0..base.len()).collect();
    pool.install(|| {
        idx.par_iter()
            .map_init(
                || {
                    let f = File::open(path).unwrap();
                    unsafe { ZipArchive::unsafe_new_with_metadata(f, meta.clone()) }
                },
                |ar, &i| {
                    let f = ar.by_index(i).unwrap();
                    let want = f.size().min(HEADER_PROBE);
                    let mut buf = Vec::with_capacity(want as usize);
                    f.take(want).read_to_end(&mut buf).unwrap();
                    read_dimensions(&buf).unwrap().width as usize
                },
            )
            .sum()
    })
}

/// One entry read through a shared, locked archive handle, with the lock held across the
/// decompression — the mistake the whole restructure removes, kept measurable.
fn zip_read_shared(archive: &Mutex<ZipArchive<File>>, index: usize) -> usize {
    let mut guard = archive.lock().unwrap();
    let mut f = guard.by_index(index).unwrap();
    let mut buf = Vec::with_capacity(f.size() as usize);
    f.read_to_end(&mut buf).unwrap();
    buf.len()
}

/// N/2 threads all funnelled through one `Mutex<ZipArchive>`, holding the lock across
/// each decompression: the shape the container layer used to impose, reproduced here so
/// the per-thread version below still has something to be measured against.
fn zip_burst_shared(path: &Path, indices: &[usize], pool: &rayon::ThreadPool) {
    let archive = Mutex::new(ZipArchive::new(File::open(path).unwrap()).unwrap());
    pool.install(|| {
        indices.par_iter().for_each(|&i| {
            let buf = {
                let mut guard = archive.lock().unwrap();
                let mut f = guard.by_index(i).unwrap();
                let mut buf = Vec::with_capacity(f.size() as usize);
                f.read_to_end(&mut buf).unwrap();
                buf
            };
            std::hint::black_box(Image::new(buf).unwrap());
        });
    });
}

/// N/2 threads, each with its own archive handle.
fn zip_burst_per_thread(path: &Path, indices: &[usize], pool: &rayon::ThreadPool) {
    let base = ZipArchive::new(File::open(path).unwrap()).unwrap();
    let meta = base.metadata();
    pool.install(|| {
        indices.par_iter().for_each_init(
            || {
                let f = File::open(path).unwrap();
                unsafe { ZipArchive::unsafe_new_with_metadata(f, meta.clone()) }
            },
            |ar, &i| {
                let mut f = ar.by_index(i).unwrap();
                let mut buf = Vec::with_capacity(f.size() as usize);
                f.read_to_end(&mut buf).unwrap();
                std::hint::black_box(crate::image::types::Image::new(buf).unwrap());
            },
        );
    });
}

// ------------------------------------------------------------------- the bench

#[test]
#[ignore = "benchmark; run with -- --ignored"]
fn perfbench_report() {
    let threads = std::cmp::max(
        1,
        std::thread::available_parallelism().map_or(1, |n| n.get()) / 2,
    );
    let pool = rayon::ThreadPoolBuilder::new()
        .num_threads(threads)
        .build()
        .unwrap();

    println!("\n================ RookReader loading benchmark ================");
    println!(
        "cores/2 = {threads} preload threads, {PAGE_COUNT} pages of {PAGE_W}x{PAGE_H} JPEG q80"
    );

    let dir = tempfile::tempdir().expect("tempdir");
    let t = Instant::now();
    let pages: Vec<Vec<u8>> = (0..PAGE_COUNT).map(make_page).collect();
    let total: usize = pages.iter().map(Vec::len).sum();
    println!(
        "fixture generated in {:.1} s, {:.1} MiB total, {:.0} KiB/page\n",
        t.elapsed().as_secs_f64(),
        total as f64 / 1024.0 / 1024.0,
        total as f64 / PAGE_COUNT as f64 / 1024.0
    );

    let zip_path = build_zip(dir.path(), &pages);
    let dir_path = build_dir(dir.path(), &pages);
    let epub_path = build_epub(dir.path(), &pages);
    let pdf_path = build_pdf(dir.path(), &pages);
    println!(
        "zip {:.1} MiB / epub {:.1} MiB / pdf {:.1} MiB\n",
        fs::metadata(&zip_path).unwrap().len() as f64 / 1048576.0,
        fs::metadata(&epub_path).unwrap().len() as f64 / 1048576.0,
        fs::metadata(&pdf_path).unwrap().len() as f64 / 1048576.0,
    );

    // Warm the OS cache so we measure steady-state behaviour, not first-touch I/O.
    std::hint::black_box(zip_scan_full(&zip_path));

    // ---------------------------------------------------------------- ZIP
    println!("--- ZIP / CBZ ---");
    let zip: Arc<dyn Container> =
        Arc::new(ZipContainer::new(zip_path.to_string_lossy().as_ref(), "").expect("open zip"));
    let entries = zip.get_entries().clone();
    bench("ZipContainer::new (open)", 5, || {
        ZipContainer::new(zip_path.to_string_lossy().as_ref(), "").unwrap()
    });
    let ab_full = bench("scan: full inflate, one shared handle", 3, || {
        zip_scan_full(&zip_path)
    });
    let ab_hdr = bench("scan: header-only probe (64 KiB cap)", 3, || {
        zip_scan_header_only(&zip_path)
    });
    let ab_par = bench("scan: per-thread handles + header-only", 3, || {
        zip_scan_parallel_header_only(&zip_path, &pool)
    });
    let one_img = bench("read_page + pipeline (1 page, warm)", 20, || {
        page(&zip, &entries[7])
    });
    let one_thumb = bench("thumbnail (1 page) [= what a preview would cost]", 20, || {
        thumbnail(&zip, &entries[7])
    });

    let burst: Vec<String> = entries[..BURST].to_vec();
    let burst_idx: Vec<usize> = (0..BURST).collect();
    let seq = bench("preload burst 20 pages, sequential", 3, || {
        for e in &burst {
            std::hint::black_box(page(&zip, e));
        }
    });
    let par_shared = bench("preload burst 20 pages, one shared handle", 3, || {
        zip_burst_shared(&zip_path, &burst_idx, &pool)
    });
    let par_own = bench("preload burst 20 pages, per-thread handles", 3, || {
        zip_burst_per_thread(&zip_path, &burst_idx, &pool)
    });

    // Head-of-line blocking, reproduced standalone: one shared, locked archive handle,
    // with a whole-book scan holding it while a page read waits behind.
    let idle = {
        let mut samples = Vec::new();
        let archive = Mutex::new(ZipArchive::new(File::open(&zip_path).unwrap()).unwrap());
        for _ in 0..5 {
            let t = Instant::now();
            std::hint::black_box(zip_read_shared(&archive, 0));
            samples.push(t.elapsed());
        }
        median(samples)
    };
    let blocked = {
        let archive = Arc::new(Mutex::new(
            ZipArchive::new(File::open(&zip_path).unwrap()).unwrap(),
        ));
        let scanner = Arc::clone(&archive);
        let count = entries.len();
        let handle = std::thread::spawn(move || {
            for i in 0..count {
                std::hint::black_box(zip_read_shared(&scanner, i));
            }
        });
        std::thread::sleep(Duration::from_millis(20));
        let t = Instant::now();
        std::hint::black_box(zip_read_shared(&archive, 0));
        let waited = t.elapsed();
        handle.join().unwrap();
        waited
    };
    println!(
        "  {:<52} {:>9.2} ms",
        "page 0 through a shared handle, scanner idle",
        ms(idle)
    );
    println!(
        "  {:<52} {:>9.2} ms",
        "page 0 through a shared handle, while a scan holds it",
        ms(blocked)
    );

    println!(
        "\n  => dim scan = {:.0}x one page load; header-only {:.1}x faster; +parallel {:.1}x faster",
        ms(ab_full) / ms(one_img),
        ms(ab_full) / ms(ab_hdr),
        ms(ab_full) / ms(ab_par)
    );
    println!(
        "  => preview/full cost ratio {:.1}x; rayon speedup now {:.2}x, with A1 {:.2}x",
        ms(one_thumb) / ms(one_img),
        ms(seq) / ms(par_shared),
        ms(seq) / ms(par_own)
    );
    println!(
        "  => page-0 latency inflated {:.0}x by the scan\n",
        ms(blocked) / ms(idle)
    );

    // ------------------------------------------------- ZIP through PageService
    //
    // Everything above calls the container directly, which is what the app used to do.
    // These lines drive the same archive through the scheduler the app actually uses:
    // one queue, per-thread readers, a header-only probe, and foreground jobs that
    // outrank a running scan.
    println!("--- ZIP via PageService ---");

    let service_for = |cache: Cache| {
        Arc::new(PageService::new(
            "bench".to_string(),
            Arc::clone(&zip),
            Pipeline {
                max_image_height: 0,
                resize_method: ResizeFilter::Bilinear,
            },
            cache,
        ))
    };
    // A fresh cache per sample, or the second one measures a hash lookup.
    let fresh = || mini_moka::sync::Cache::new(1_000);

    let svc_dim = bench("PageService::dimensions (200 pages)", 3, || {
        service_for(fresh()).dimensions().unwrap()
    });

    let svc_burst = bench("preload burst 20 pages through the queue", 5, || {
        let service = service_for(fresh());
        service.request_preload_around(0, BURST - 1).unwrap();
        while entries[..BURST]
            .iter()
            .any(|entry| service.cached(entry).is_none())
        {
            std::thread::yield_now();
        }
    });

    let svc_idle = {
        let mut samples = Vec::new();
        for _ in 0..5 {
            let service = service_for(fresh());
            let t = Instant::now();
            std::hint::black_box(service.page(&entries[0], Priority::Foreground).unwrap());
            samples.push(t.elapsed());
        }
        median(samples)
    };
    let svc_blocked = {
        let service = service_for(fresh());
        let scanner = Arc::clone(&service);
        let handle = std::thread::spawn(move || {
            let _ = scanner.dimensions();
        });
        // Long enough for the scan to be well under way, as above.
        std::thread::sleep(Duration::from_millis(20));
        let t = Instant::now();
        std::hint::black_box(service.page(&entries[0], Priority::Foreground).unwrap());
        let waited = t.elapsed();
        service.close();
        let _ = handle.join();
        waited
    };
    println!(
        "  {:<52} {:>9.2} ms",
        "page(0), scanner idle",
        ms(svc_idle)
    );
    println!(
        "  {:<52} {:>9.2} ms",
        "page(0), while dimensions() runs",
        ms(svc_blocked)
    );

    println!(
        "\n  => dim scan {:.1}x faster than the shared-handle pass ({:.1} ms vs {:.1} ms)",
        ms(ab_full) / ms(svc_dim),
        ms(svc_dim),
        ms(ab_full)
    );
    println!(
        "  => preload burst {:.1}x faster than the shared-handle pool ({:.1} ms vs {:.1} ms)",
        ms(par_shared) / ms(svc_burst),
        ms(svc_burst),
        ms(par_shared)
    );
    println!(
        "  => page-0 latency during a scan {:.0}x lower ({:.1} ms vs {:.1} ms); inflated {:.1}x rather than {:.0}x\n",
        ms(blocked) / ms(svc_blocked),
        ms(svc_blocked),
        ms(blocked),
        ms(svc_blocked) / ms(svc_idle),
        ms(blocked) / ms(idle)
    );

    // ---------------------------------------------------------------- Directory
    println!("--- Directory ---");
    let d: Arc<dyn Container> =
        Arc::new(DirectoryContainer::new(dir_path.to_string_lossy().as_ref()).expect("open dir"));
    let d_entries = d.get_entries().clone();
    bench("DirectoryContainer::new (open)", 5, || {
        DirectoryContainer::new(dir_path.to_string_lossy().as_ref()).unwrap()
    });
    let d_dim = bench("scan through one reader", 5, || scan(&d, &d_entries));
    let d_par = bench("  E2: same scan, rayon", 5, || {
        let names = &d_entries;
        pool.install(|| {
            names
                .par_iter()
                .map(|e| {
                    let p = dir_path.join(e);
                    image::ImageReader::open(p)
                        .unwrap()
                        .with_guessed_format()
                        .unwrap()
                        .into_dimensions()
                        .unwrap()
                })
                .collect::<Vec<_>>()
        })
    });
    let d_img = bench("read_page + pipeline (1 page, warm)", 20, || {
        page(&d, &d_entries[7])
    });
    let d_thumb = bench("thumbnail (1 page)", 20, || thumbnail(&d, &d_entries[7]));
    println!(
        "\n  => scan rayon speedup {:.1}x; preview/full {:.1}x\n",
        ms(d_dim) / ms(d_par),
        ms(d_thumb) / ms(d_img)
    );

    // ---------------------------------------------------------------- EPUB
    println!("--- EPUB ---");
    let e_open = bench("EpubContainer::new (open, incl. spine HTML parse)", 3, || {
        EpubContainer::new(epub_path.to_string_lossy().as_ref()).unwrap()
    });
    let ep: Arc<dyn Container> =
        Arc::new(EpubContainer::new(epub_path.to_string_lossy().as_ref()).expect("open epub"));
    let e_entries = ep.get_entries().clone();
    let e_dim = bench("scan through one reader", 3, || scan(&ep, &e_entries));
    let e_img = bench("read_page + pipeline (1 page, warm)", 20, || {
        page(&ep, &e_entries[7])
    });
    let e_thumb = bench("thumbnail (1 page)", 20, || thumbnail(&ep, &e_entries[7]));
    println!(
        "\n  => open = {:.0}x one page load; dim scan {:.0}x; preview/full {:.1}x\n",
        ms(e_open) / ms(e_img),
        ms(e_dim) / ms(e_img),
        ms(e_thumb) / ms(e_img)
    );

    // ---------------------------------------------------------------- RAR
    println!("--- RAR (3-entry fixture: no RAR writer on this machine) ---");
    let rar_src = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("resources")
        .join("test.rar");
    if rar_src.exists() {
        let rar_path = dir.path().join("bench.rar");
        fs::copy(&rar_src, &rar_path).expect("copy rar");
        let r: Arc<dyn Container> =
            Arc::new(RarContainer::new(rar_path.to_string_lossy().as_ref(), "").expect("open rar"));
        let r_entries = r.get_entries().clone();
        bench("RarContainer::new (open_for_listing)", 20, || {
            RarContainer::new(rar_path.to_string_lossy().as_ref(), "").unwrap()
        });
        let r0 = bench("read_page entry #0 (fresh reader)", 30, || {
            page(&r, &r_entries[0])
        });
        let r_last = bench("read_page last entry (fresh reader)", 30, || {
            page(&r, r_entries.last().unwrap())
        });
        bench("thumbnail entry #0", 30, || thumbnail(&r, &r_entries[0]));
        bench("scan through one cursor reader", 20, || scan(&r, &r_entries));
        println!(
            "\n  => per-entry scan step {:.3} ms over {} entries ({:.3} -> {:.3} ms)\n",
            (ms(r_last) - ms(r0)) / (r_entries.len() as f64 - 1.0),
            r_entries.len(),
            ms(r0),
            ms(r_last)
        );
    } else {
        println!("  fixture missing, skipped\n");
    }

    // ---------------------------------------------------------------- PDF
    println!("--- PDF ---");
    use pdfium_render::prelude::PdfRenderConfig;
    let lib = pdfium_lib_path();
    // Nothing here may construct a `Pdfium`. One thread owns the process's only instance
    // and never drops it; a second one built to time a bind would call
    // FPDF_DestroyLibrary on the way out and unload the library under that thread, which
    // hangs the process. The per-call bind and document-load costs this section used to
    // report no longer exist to be measured: the bind happens once per process, and the
    // open documents are kept beside the library.
    bench("PdfContainer::new (open)", 5, || {
        PdfContainer::new(
            pdf_path.to_string_lossy().as_ref(),
            PdfRenderConfig::default().set_target_height(2000),
            Some(lib.clone()),
        )
        .unwrap()
    });

    let p: Arc<dyn Container> = Arc::new(
        PdfContainer::new(
            pdf_path.to_string_lossy().as_ref(),
            PdfRenderConfig::default().set_target_height(2000),
            Some(lib.clone()),
        )
        .expect("open pdf"),
    );
    let p_entries = p.get_entries().clone();
    let p_img = bench("read_page (1 page: render + encode)", 10, || {
        page(&p, &p_entries[7])
    });
    let p_dim = bench("scan (page sizes only)", 5, || scan(&p, &p_entries));
    let p_thumb = bench("thumbnail (1 page)", 10, || thumbnail(&p, &p_entries[7]));
    println!(
        "  => dim scan {:.1} ms, preview/full {:.2}x
",
        ms(p_dim),
        ms(p_thumb) / ms(p_img)
    );

    println!("=============================================================\n");
}

// ------------------------------------------------------- RAR at realistic scale

/// Writes the exact page set the ZIP/EPUB/PDF benchmarks use, so a RAR archive can be
/// built from it by hand (no RAR writer exists on this machine).
///
/// Destination: `ROOKREADER_BENCH_PAGES`, else `%USERPROFILE%\bench-pages`.
#[test]
#[ignore = "benchmark; run with -- --ignored"]
fn perfbench_export_pages() {
    let out = std::env::var("ROOKREADER_BENCH_PAGES").unwrap_or_else(|_| {
        let home = std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .unwrap_or_else(|_| ".".to_string());
        format!("{home}/bench-pages")
    });
    let out = PathBuf::from(out);
    fs::create_dir_all(&out).expect("create export dir");

    let mut total = 0usize;
    for i in 0..PAGE_COUNT {
        let bytes = make_page(i);
        total += bytes.len();
        fs::write(out.join(page_name(i)), &bytes).expect("write page");
    }
    println!(
        "
exported {} pages, {:.1} MiB total, {:.0} KiB/page
  -> {}
",
        PAGE_COUNT,
        total as f64 / 1048576.0,
        total as f64 / PAGE_COUNT as f64 / 1024.0,
        out.display()
    );
}

/// Measures RAR on archives supplied from outside.
///
/// `ROOKREADER_BENCH_RAR` holds one or more `;`-separated paths.
#[test]
#[ignore = "benchmark; run with -- --ignored"]
fn perfbench_rar_at_scale() {
    let Ok(list) = std::env::var("ROOKREADER_BENCH_RAR") else {
        println!("
set ROOKREADER_BENCH_RAR=<path>[;<path>] to run this
");
        return;
    };

    let threads = std::cmp::max(
        1,
        std::thread::available_parallelism().map_or(1, |n| n.get()) / 2,
    );
    let pool = rayon::ThreadPoolBuilder::new()
        .num_threads(threads)
        .build()
        .unwrap();

    for path in list.split(';').filter(|p| !p.trim().is_empty()) {
        let path = path.trim();
        let size = fs::metadata(path).map(|m| m.len()).unwrap_or(0);
        println!(
            "
=== RAR: {} ({:.1} MiB), {} preload threads ===",
            path,
            size as f64 / 1048576.0,
            threads
        );
        let c: Arc<dyn Container> = match RarContainer::new(path, "") {
            Ok(c) => Arc::new(c),
            Err(e) => {
                println!("  cannot open: {e}");
                continue;
            }
        };
        let entries = c.get_entries().clone();
        println!("  entries: {}", entries.len());
        if entries.is_empty() {
            continue;
        }

        bench("RarContainer::new (open_for_listing)", 5, || {
            RarContainer::new(path, "").unwrap()
        });

        // Does the per-page cost grow with the entry index? That is the O(N) rescan.
        let last = entries.len() - 1;
        let probes: Vec<usize> = [0usize, last / 4, last / 2, last]
            .into_iter()
            .filter(|i| *i <= last)
            .collect();
        let mut probe_ms = Vec::new();
        for i in probes.iter().copied() {
            // A fresh reader per page is what the container layer used to do for every
            // request, and it is the floor the cursor walk below is measured against.
            let d = bench(&format!("read_page entry #{i} (fresh reader each time)"), 3, || {
                page(&c, &entries[i])
            });
            probe_ms.push((i, ms(d)));
        }

        // The same probe points, but through one `PageReader` walked forward — the order
        // a book is actually read in. Above, every call reopens the archive and, on a
        // solid one, decompresses everything before its target; here the cursor is
        // already standing there.
        let mut reader = c.open_reader().expect("open reader");
        let mut walk_ms: Vec<(usize, f64)> = Vec::new();
        let walk_started = Instant::now();
        for (i, entry) in entries.iter().enumerate() {
            let t = Instant::now();
            std::hint::black_box(reader.read_page(entry).unwrap());
            let step = t.elapsed();
            if probes.contains(&i) {
                walk_ms.push((i, ms(step)));
            }
        }
        let walk_total = walk_started.elapsed();
        for (i, step) in &walk_ms {
            println!(
                "  {:<52} {:>9.2} ms",
                format!("read_page entry #{i} (one cursor, walked forward)"),
                step
            );
        }
        println!(
            "  {:<52} {:>9.2} ms",
            format!("full forward read-through, all {} pages", entries.len()),
            ms(walk_total)
        );

        bench("thumbnail entry #0", 3, || thumbnail(&c, &entries[0]));
        let dim = bench("scan through one cursor reader", 3, || scan(&c, &entries));

        let burst: Vec<String> = entries[..BURST.min(entries.len())].to_vec();
        let seq = bench("preload burst 20 pages, sequential", 3, || {
            for e in &burst {
                std::hint::black_box(page(&c, e));
            }
        });
        let par = bench("preload burst 20 pages, rayon", 3, || {
            pool.install(|| {
                burst.par_iter().for_each(|e| {
                    std::hint::black_box(page(&c, e));
                });
            })
        });

        let (w0, wt0) = walk_ms[0];
        let (w1, wt1) = *walk_ms.last().unwrap();
        println!(
            "
  => cursor per-page #{} = {:.2} ms -> #{} = {:.2} ms ({:.1}x); whole book in {:.2} s",
            w0,
            wt0,
            w1,
            wt1,
            wt1 / wt0.max(0.0001),
            walk_total.as_secs_f64()
        );

        let (i0, t0) = probe_ms[0];
        let (i1, t1) = *probe_ms.last().unwrap();
        println!(
            "
  => per-page cost #{} = {:.1} ms -> #{} = {:.1} ms ({:.1}x, {:.3} ms per skipped entry)",
            i0,
            t0,
            i1,
            t1,
            t1 / t0.max(0.0001),
            (t1 - t0) / (i1 as f64 - i0 as f64).max(1.0)
        );
        println!(
            "  => whole-book read-through would cost ~{:.1} s at the mean probe cost",
            probe_ms.iter().map(|(_, t)| t).sum::<f64>() / probe_ms.len() as f64
                * entries.len() as f64
                / 1000.0
        );
        println!(
            "  => dim scan {:.1} ms; rayon preload speedup {:.2}x (>1 helps, <1 hurts)
",
            ms(dim),
            ms(seq) / ms(par)
        );
    }
}

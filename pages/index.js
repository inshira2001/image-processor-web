import { useState, useRef, useCallback } from "react";

const FILTERS = ["grayscale", "blur", "sepia"];
const POLL_INTERVAL = 2000;

export default function Home() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [filter, setFilter] = useState("grayscale");
  const [dragging, setDragging] = useState(false);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);
  const pollRef = useRef(null);

  const pickFile = (f) => {
    if (!f || !f.type.startsWith("image/")) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setJob(null);
    setError(null);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files[0]);
  }, []);

  const startPolling = (jobId) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/status/${jobId}`);
      const data = await res.json();
      setJob(data);
      if (data.status === "DONE" || data.status === "FAILED") {
        clearInterval(pollRef.current);
      }
    }, POLL_INTERVAL);
  };

  const submit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setJob(null);
    try {
      // 1. Get presigned upload URL + create DynamoDB job
      const initRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type }),
      });
      if (!initRes.ok) throw new Error("Failed to initialise upload");
      const { jobId, uploadUrl, inputKey } = await initRes.json();

      // 2. Upload directly to S3
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("S3 upload failed");

      // 3. Enqueue the job
      const submitRes = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, inputKey, filter }),
      });
      if (!submitRes.ok) throw new Error("Failed to submit job");

      setJob({ jobId, status: "PENDING" });
      startPolling(jobId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (s) => {
    const cls = { PENDING: "badge-pending", PROCESSING: "badge-processing", DONE: "badge-done", FAILED: "badge-failed" };
    return <span className={`badge ${cls[s] || "badge-pending"}`}>{s}</span>;
  };

  return (
    <div className="container">
      <h1>Image Processor</h1>
      <p className="subtitle">Upload an image, pick a filter, and let the cloud do the work.</p>

      <div className="card">
        <label>Image</label>
        <div
          className={`drop-zone${dragging ? " active" : ""}`}
          onClick={() => fileRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input ref={fileRef} type="file" accept="image/*" onChange={(e) => pickFile(e.target.files[0])} />
          {preview
            ? <img src={preview} alt="preview" className="preview-img" />
            : <p><span>Click to upload</span> or drag and drop</p>}
        </div>
      </div>

      <div className="card">
        <label>Filter</label>
        <div className="filter-grid">
          {FILTERS.map((f) => (
            <button key={f} className={`filter-btn${filter === f ? " selected" : ""}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <button className="btn" onClick={submit} disabled={!file || loading}>
        {loading ? "Processing…" : "Process Image"}
      </button>

      {error && <p className="error-msg">{error}</p>}

      {job && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="status-row">
            {statusBadge(job.status)}
            {(job.status === "PENDING" || job.status === "PROCESSING") && <span className="spinner" />}
            <span className="job-id">{job.jobId}</span>
          </div>

          {job.status === "DONE" && job.outputUrl && (
            <>
              <img src={job.outputUrl} alt="processed" className="result-img" />
              <a href={job.outputUrl} download className="download-link">Download processed image</a>
            </>
          )}

          {job.status === "FAILED" && (
            <p className="error-msg">Processing failed: {job.error || "unknown error"}</p>
          )}
        </div>
      )}
    </div>
  );
}

import argparse
from pathlib import Path
from app.services.pipeline import run_pipeline


def main():
    parser = argparse.ArgumentParser(description="Run TrustLedger starter dataset ingestion and validation")
    parser.add_argument("--data", default="../data/raw", help="Directory containing the hackathon CSV files")
    parser.add_argument("--output", default="../data/processed", help="Directory for generated outputs")
    args = parser.parse_args()
    data_dir = Path(args.data).resolve()
    output_dir = Path(args.output).resolve()
    result = run_pipeline(data_dir, output_dir)
    print("TrustLedger pipeline complete")
    for key, value in result.items():
        print(f"{key}: {value}")


if __name__ == "__main__":
    main()

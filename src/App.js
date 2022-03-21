import { initNotifications, notify } from '@mycv/f8-notification';
import * as knnClassifier from '@tensorflow-models/knn-classifier';
import * as mobilenet from '@tensorflow-models/mobilenet';
import '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import { Howl } from 'howler';
import React, { useEffect, useRef, useState } from 'react';
import './App.css';
import soundWarning from './assets/warning.mp3';

const sound = new Howl({
	src: [soundWarning],
});

const NOT_TOUCH_LABEL = 'not_touch';
const TOUCHED_LABEL = 'touched';
const TRAINING_TIMES = 50;
const TOUCHED_CONFIDENCE = 0.8;

function App() {
	const videoRef = useRef();
	const canPlaySound = useRef(true);
	const mobilenetModel = useRef();
	const classifier = useRef();
	const [touched, setTouched] = useState(false);
	const [note, setNote] = useState('Finding the camera...');
	const [showStep, setShowStep] = useState(0);

	const init = async () => {
		await setupCamera();
		mobilenetModel.current = await mobilenet.load();
		classifier.current = knnClassifier.create();

		setNote('AI is starting...');
		// request after 3 seconds
		initNotifications({ cooldown: 3000 });
		await sleep(1000);
		setShowStep(1);
		setNote('Step 1: Take a video without touching your face');
	};

	const setupCamera = () => {
		return new Promise((resolve, reject) => {
			navigator.getUserMedia =
				navigator.getUserMedia ||
				navigator.webkitGetUserMedia ||
				navigator.mozGetUserMedia ||
				navigator.msGetUserMedia;

			if (navigator.getUserMedia) {
				navigator.getUserMedia(
					{ video: true },
					stream => {
						videoRef.current.srcObject = stream;
						videoRef.current.addEventListener(
							'loadeddata',
							resolve
						);
					},
					err => reject(setNote('Not found camera'))
				);
			} else {
				reject(setNote('Not found camera'));
			}
		});
	};

	const train = async label => {
		setShowStep(0);

		for (let i = 0; i < TRAINING_TIMES; i++) {
			setNote(
				`Progress: ${parseInt(((i + 1) / TRAINING_TIMES) * 100)} %`
			);

			await training(label);
			if (label === NOT_TOUCH_LABEL && i === TRAINING_TIMES - 1) {
				setNote('Step 2: Take a video with touched your face');
				setShowStep(2);
			} else if (label === TOUCHED_LABEL && i === TRAINING_TIMES - 1) {
				setNote('Step 3: AI ready. Click Run to start');
				setShowStep(3);
			}
		}
	};

	const training = label => {
		return new Promise(async resolve => {
			const embedding = mobilenetModel.current.infer(
				videoRef.current,
				true
			);

			classifier.current.addExample(embedding, label);
			await sleep(100);
			resolve();
		});
	};

	const run = async () => {
		const embedding = mobilenetModel.current.infer(videoRef.current, true);
		const result = await classifier.current.predictClass(embedding);

		if (
			result.label === TOUCHED_LABEL &&
			result.confidences[result.label] > TOUCHED_CONFIDENCE
		) {
			setNote('You are touching your face');
			setTouched(true);
			if (canPlaySound.current) {
				sound.play();
				canPlaySound.current = false;
			}
			notify('Warning', { body: 'You are touching your face' });
		} else {
			setNote('You are not touching your face');
			setTouched(false);
		}

		await sleep(200);
		setShowStep(0);

		run();
	};

	const sleep = (ms = 0) => {
		return new Promise(resolve => setTimeout(resolve, ms));
	};

	useEffect(() => {
		init();

		// Fires when the sound finishes playing.
		sound.on('end', function () {
			canPlaySound.current = true;
		});

		return () => {};
	}, []);

	return (
		<div className={`main ${touched ? 'touched' : ''}`}>
			<div className='app'>
				<video ref={videoRef} autoPlay className='video'></video>
				<div className='controls'>
					<p className='note'>{note}</p>
					{showStep === 1 && (
						<button
							className='btn'
							onClick={() => {
								train(NOT_TOUCH_LABEL);
							}}
						>
							Start
						</button>
					)}

					{showStep === 2 && (
						<button
							className='btn'
							onClick={() => {
								train(TOUCHED_LABEL);
							}}
						>
							Continue
						</button>
					)}

					{showStep === 3 && (
						<button className='btn' onClick={() => run()}>
							Run
						</button>
					)}
				</div>
			</div>
		</div>
	);
}

export default App;
